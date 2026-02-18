from typing import Dict, Any, List, Optional
from shapely.geometry import shape, Point
from app.http_client import cadastre_client, gpu_client, georisques_client, ign_client
from app.logging_config import get_logger

logger = get_logger(__name__)

class FaisabiliteService:
    """Service pour générer des rapports de faisabilité foncière"""

    async def get_parcelle_data(self, parcelle_id: str) -> Dict[str, Any]:
        """Récupère les données cadastrales brutes"""
        code_insee = parcelle_id[:5]
        try:
            url = f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
            data = await cadastre_client.get(url)
            for feature in data.get("features", []):
                if feature.get("properties", {}).get("id") == parcelle_id:
                    return feature
            return None
        except Exception as e:
            logger.error(f"Erreur cadastre pour {parcelle_id}: {e}")
            return None

    async def generate_report(self, parcelle_id: str) -> Dict[str, Any]:
        """Génère le rapport complet"""
        
        # 1. Infos Parcelle
        parcelle = await self.get_parcelle_data(parcelle_id)
        if not parcelle:
            raise ValueError("Parcelle introuvable")

        props = parcelle.get("properties", {})
        geometry = parcelle.get("geometry")
        
        # Calcul du centroïde pour les requêtes géographiques
        try:
            geom_shape = shape(geometry)
            centroid = geom_shape.centroid
            lon, lat = centroid.x, centroid.y
        except Exception:
            # Fallback (approximation si geom invalide)
            lon, lat = 0, 0 

        # 2. Parallélisation des appels (idéalement)
        # Pour l'instant séquentiel simple pour la stabilité
        
        # Urbanisme (PLU)
        zonage = []
        
        # Essai 1: Par partition (ID Parcelle), plus précis
        try:
            gpu_resp = await gpu_client.get("/zone-urba", params={"partition": parcelle_id})
            zonage = gpu_resp.get("features", [])
        except Exception as e:
            logger.warning(f"GPU Partition ({parcelle_id}) Echec: {e}")

        # Essai 2: Fallback Géométrie (Point) si partition ne donne rien
        if not zonage:
            try:
                gpu_resp = await gpu_client.get("/zone-urba", params={"geom": f"POINT({lon} {lat})"})
                zonage = gpu_resp.get("features", [])
            except Exception as e:
                logger.warning(f"GPU Géométrie (Point) Echec: {e}")
        
        # Essai 3: Fallback Document si toujours rien
        if not zonage:
            try:
                 doc_resp = await gpu_client.get("/document", params={"geom": f"POINT({lon} {lat})"})
                 docs = doc_resp.get("features", [])
                 if docs:
                    zonage = [{"properties": {"typezone": "INFO_DOC", "libelle": f"Document: {docs[0].get('properties', {}).get('typeDocument')}"}}]
            except Exception:
                 pass

        # Risques
        risques = []
        try:
            geo_resp = await georisques_client.get("/gaspar/risques", params={"latlon": f"{lat},{lon}", "rayon": 100})
            risques = geo_resp.get("data", [])
        except Exception as e:
            logger.warning(f"Erreur Georisques: {e}")

        # Bâti (IGN)
        # On vérifie si la parcelle intersecte un bâtiment
        is_built = False
        try:
            # On récupère les bâtiments de la commune (peut être lourd si pas de filtre spatial fin)
            # Optimisation: BBOX autour de la parcelle ? 
            # WFS supporte BBOX.
            bounds = geom_shape.bounds # (minx, miny, maxx, maxy)
            bbox = f"{bounds[0]},{bounds[1]},{bounds[2]},{bounds[3]}"
            
            # Note: API IGN WFS prend bbox=minx,miny,maxx,maxy
            ign_resp = await ign_client.get("", params={
                "SERVICE": "WFS",
                "VERSION": "2.0.0",
                "REQUEST": "GetFeature",
                "TYPENAME": "BDTOPO_V3:batiment",
                "OUTPUTFORMAT": "application/json",
                "BBOX": bbox,
                "SRSNAME": "EPSG:4326"
            })
            
            batiments = ign_resp.get("features", [])
            for bat in batiments:
                if shape(bat.get("geometry")).intersects(geom_shape):
                    is_built = True
                    break
        except Exception as e:
            logger.warning(f"Erreur IGN Bati: {e}")

        # 3. Synthèse / Analyse
        
        # Analyse Zonage
        constructibilite_plu = "Indéterminée"
        zones_codes = [z.get("properties", {}).get("typezone") for z in zonage]
        if "U" in zones_codes:
            constructibilite_plu = "Constructible (Zone U)"
        elif "AU" in zones_codes:
            constructibilite_plu = "A Urbaniser (Zone AU)"
        elif "N" in zones_codes:
            constructibilite_plu = "Non Constructible (Zone N)"
        elif "A" in zones_codes:
            constructibilite_plu = "Agricole (Zone A)"
        elif "INFO_DOC" in zones_codes:
            # On récupère le libellé du document
            doc_info = next((z.get("properties", {}).get("libelle") for z in zonage if z.get("properties", {}).get("typezone") == "INFO_DOC"), "Document existant")
            constructibilite_plu = "À vérifier (Zone non précise)"
            conclusion = "À vérifier en mairie"
            details.append(f"{doc_info} - Zonage précis non disponible via API")
        elif not zones_codes:
            constructibilite_plu = "RNU / Non numérisé"
            conclusion = "À vérifier en mairie"
            details.append("Aucun document d'urbanisme numérique trouvé sur le Géoportail")

        # Conclusion Globale
        conclusion = "Favorable"
        details = []

        if constructibilite_plu.startswith("Non") or constructibilite_plu.startswith("Agricole"):
            conclusion = "Défavorable"
            details.append("Zone non constructible")
        
        if is_built:
            details.append("Terrain déjà bâti")
            if conclusion == "Favorable": conclusion = "A vérifier (Division ?)"

        if risques:
            count_high = len([r for r in risques if r.get("niveau_risque") == "Fort"])
            if count_high > 0:
                conclusion = "Complexe (Risques Forts)"
                details.append(f"{count_high} risques forts détectés")

        return {
            "parcelle_id": parcelle_id,
            "adresse": f"{props.get('numero', '')} {props.get('nom_voie', '')}, {props.get('code_postal', '')} {props.get('nom_commune', '')}",
            "surface": props.get("contenance"),
            "zonage": [z.get("properties") for z in zonage],
            "risques": [{"libelle": r.get("libelle_risque_long"), "niveau": r.get("niveau_risque")} for r in risques],
            "is_built": is_built,
            "synthese": {
                "constructibilite": constructibilite_plu,
                "conclusion": conclusion,
                "points_vigilance": details
            }
        }

faisabilite_service = FaisabiliteService()
