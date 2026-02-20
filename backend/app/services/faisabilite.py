from typing import Dict, Any, List, Optional
from shapely.geometry import shape, Point
from app.http_client import cadastre_client, gpu_client, georisques_client, ign_client
from app.cache import cache_get
from app.logging_config import get_logger

logger = get_logger(__name__)

class FaisabiliteService:
    """Service pour générer des rapports de faisabilité foncière"""

    async def get_parcelle_data(self, parcelle_id: str) -> Dict[str, Any]:
        """Récupère les données cadastrales (Cache > API)"""
        code_insee = parcelle_id[:5]
        cache_key = f"parcelles:{code_insee}"
        
        # 1. Check Cache
        try:
            cached_data = await cache_get(cache_key)
            if cached_data:
                for feature in cached_data.get("features", []):
                     if feature.get("properties", {}).get("id") == parcelle_id:
                         return feature
        except Exception as e:
            logger.warning(f"Faisabilité: Erreur lecture cache {e}")

        # 2. API Fallback
        try:
            url = f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
            logger.info(f"Faisabilité: Fetching API Cadastre pour {code_insee}")
            data = await cadastre_client.get(url)
            for feature in data.get("features", []):
                if feature.get("properties", {}).get("id") == parcelle_id:
                    return feature
            
            logger.error(f"Faisabilité: Parcelle {parcelle_id} introuvable dans la commune {code_insee}")
            return None
        except Exception as e:
            logger.error(f"Erreur API Cadastre pour {parcelle_id}: {e}")
            return None

    async def generate_report(self, parcelle_id: str) -> Dict[str, Any]:
        """Génère le rapport complet (Tolérant aux pannes)"""
        
        # 1. Infos Parcelle
        parcelle = await self.get_parcelle_data(parcelle_id)
        if not parcelle:
            # Si pas de cache ni API, on ne peut rien faire
            logger.error(f"Faisabilité: Parcelle {parcelle_id} introuvable.")
            raise ValueError("Parcelle introuvable")

        props = parcelle.get("properties", {})
        geometry = parcelle.get("geometry")
        
        # Calcul du centroïde pour les requêtes géographiques
        lon, lat = 0, 0
        geom_shape = None
        try:
            if geometry:
                geom_shape = shape(geometry)
                centroid = geom_shape.centroid
                lon, lat = centroid.x, centroid.y
        except Exception as e:
            logger.warning(f"Faisabilité: Erreur géométrie {parcelle_id}: {e}")

        # 2. Urbanisme (PLU) - GPU
        zonage = []
        try:
            # Essai 1: Partition
            gpu_resp = await gpu_client.get("/zone-urba", params={"partition": parcelle_id})
            zonage = gpu_resp.get("features", [])
        except Exception as e:
            logger.warning(f"Faisabilité: GPU Partition ({parcelle_id}) Echec: {e}")

        import json
        # Essai 2: Géométrie
        if not zonage and geom_shape:
            try:
                geom_geojson = json.dumps({"type": "Point", "coordinates": [lon, lat]})
                gpu_resp = await gpu_client.get("/zone-urba", params={"geom": geom_geojson})
                zonage = gpu_resp.get("features", [])
            except Exception as e:
                logger.warning(f"Faisabilité: GPU Point Echec: {e}")
        
        # Essai 3: Document
        if not zonage and geom_shape:
            try:
                 geom_geojson = json.dumps({"type": "Point", "coordinates": [lon, lat]})
                 doc_resp = await gpu_client.get("/document", params={"geom": geom_geojson})
                 docs = doc_resp.get("features", [])
                 if docs:
                    doc_type = docs[0].get('properties', {}).get('typeDocument', 'Inconnu')
                    zonage = [{"properties": {"typezone": "INFO_DOC", "libelle": f"Document: {doc_type}"}}]
            except Exception:
                 pass

        # 3. Risques - Georisques
        risques = []
        if geom_shape:
            try:
                geo_resp = await georisques_client.get("/gaspar/risques", params={"latlon": f"{lat},{lon}", "rayon": 100})
                risques = geo_resp.get("data", [])
            except Exception as e:
                logger.error(f"Faisabilité: Erreur Georisques: {e}")

        # 4. Bâti - IGN
        is_built = False
        if geom_shape:
            try:
                bounds = geom_shape.bounds # (minx, miny, maxx, maxy)
                bbox = f"{bounds[0]},{bounds[1]},{bounds[2]},{bounds[3]}"
                
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
                    try:
                        if shape(bat.get("geometry")).intersects(geom_shape):
                            is_built = True
                            break
                    except Exception:
                        continue
            except Exception as e:
                logger.error(f"Faisabilité: Erreur IGN Bati: {e}")

        # 5. Synthèse / Analyse
        
        # Analyse Zonage
        constructibilite_plu = "Indéterminée"
        conclusion = "Favorable"
        details = []

        zones_codes = [z.get("properties", {}).get("typezone") for z in zonage]
        
        if "U" in zones_codes:
            constructibilite_plu = "Constructible (Zone U)"
        elif "AU" in zones_codes:
            constructibilite_plu = "A Urbaniser (Zone AU)"
        elif "N" in zones_codes:
            constructibilite_plu = "Non Constructible (Zone N)"
            conclusion = "Défavorable"
            details.append("Zone non constructible (N)")
        elif "A" in zones_codes:
            constructibilite_plu = "Agricole (Zone A)"
            conclusion = "Défavorable"
            details.append("Zone Agricole (A)")
        elif "INFO_DOC" in zones_codes:
            constructibilite_plu = "À vérifier (Zone non précise)"
            conclusion = "À vérifier en mairie"
            details.append("Zonage précis non disponible via API")
        elif not zones_codes:
            constructibilite_plu = "RNU / Non numérisé"
            conclusion = "À vérifier en mairie"
            details.append("Aucun document d'urbanisme numérique trouvé")

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
