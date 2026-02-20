from typing import Dict, Any, List, Optional
try:
    from shapely.geometry import shape, Point
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False
from app.http_client import cadastre_client, gpu_client, georisques_client, ign_client
from app.cache import cache_get
from app.logging_config import get_logger

logger = get_logger(__name__)
if not SHAPELY_AVAILABLE:
    logger.warning("Shapely non disponible - calculs d'intersection géométrique désactivés")

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
            if geometry and SHAPELY_AVAILABLE:
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
        
        # Obtenir la géométrie GeoJSON de la parcelle pour les requêtes API
        geom_geojson = None
        if geometry:
            geom_geojson = json.dumps(geometry)

        # Essai 2: Géométrie Parcelle complète (GeoJSON) - Plus précis que le Centroïde
        if not zonage and geom_geojson:
            try:
                gpu_resp = await gpu_client.get("/zone-urba", params={"geom": geom_geojson})
                zonage = gpu_resp.get("features", [])
            except Exception as e:
                logger.warning(f"Faisabilité: GPU Polygon Echec: {e}")
                
                # Fallback au centroïde si la géométrie complète échoue (ex: trop complexe)
                if geom_shape:
                     try:
                         centroid_geojson = json.dumps({"type": "Point", "coordinates": [lon, lat]})
                         gpu_resp = await gpu_client.get("/zone-urba", params={"geom": centroid_geojson})
                         zonage = gpu_resp.get("features", [])
                     except Exception as e:
                         logger.warning(f"Faisabilité: GPU Point Fallback Echec: {e}")
        
        # Essai 3: Document
        if not zonage and geom_shape:
            try:
                 centroid_geojson = json.dumps({"type": "Point", "coordinates": [lon, lat]})
                 doc_resp = await gpu_client.get("/document", params={"geom": centroid_geojson})
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
                        if SHAPELY_AVAILABLE and shape(bat.get("geometry")).intersects(geom_shape):
                            is_built = True
                            break
                    except Exception:
                        continue
            except Exception as e:
                logger.error(f"Faisabilité: Erreur IGN Bati: {e}")

        # 5. Synthèse / Analyse
        
        # Analyse Zonage avec calcul des surfaces d'intersection
        zonage_enrichi = []
        parcelle_area = geom_shape.area if geom_shape else 0

        for zone in zonage:
            props = zone.get("properties", {})
            zone_geom_data = zone.get("geometry")
            
            enrichissement = {"properties": props}
            
            # Calcul du pourcentage d'intersection si on a les géométries
            if SHAPELY_AVAILABLE and geom_shape and zone_geom_data and parcelle_area > 0:
                try:
                    zone_shape = shape(zone_geom_data)
                    # Si la zone n'est pas valide (erreur topologique fréquente avec l'API IGN), on tente un buffer(0)
                    if not zone_shape.is_valid:
                        zone_shape = zone_shape.buffer(0)
                        
                    intersection = geom_shape.intersection(zone_shape)
                    intersection_area = intersection.area
                    
                    pourcentage = min(100.0, max(0.0, (intersection_area / parcelle_area) * 100))
                    enrichissement["properties"]["pourcentage_intersection"] = round(pourcentage, 1)
                except Exception as e:
                    logger.warning(f"Faisabilité: Erreur calcul d'intersection PLU {parcelle_id}: {e}")
                    enrichissement["properties"]["pourcentage_intersection"] = None
            else:
                 enrichissement["properties"]["pourcentage_intersection"] = None
                 
            # Garder la zone si elle intersecte significativement (> 0.5%) ou si on n'a pas pu calculer
            if enrichissement["properties"].get("pourcentage_intersection") is None or enrichissement["properties"]["pourcentage_intersection"] > 0.5:
                 zonage_enrichi.append(enrichissement)

        # Trier par pourcentage décroissant pour avoir la zone dominante en premier
        zonage_enrichi.sort(key=lambda z: z["properties"].get("pourcentage_intersection") or 0, reverse=True)

        constructibilite_plu = "Indéterminée"
        conclusion = "Favorable"
        details = []

        zones_codes = [z["properties"].get("typezone") for z in zonage_enrichi]
        
        if len(zonage_enrichi) > 1 and any(z["properties"].get("pourcentage_intersection") for z in zonage_enrichi):
            # Cas multi-zones
            parts = []
            has_unbuildable = False
            for z in zonage_enrichi:
                pct = z["properties"].get("pourcentage_intersection", 0)
                code = z["properties"].get("typezone", "?")
                if pct > 0:
                    parts.append(f"{round(pct)}% {code}")
                if code in ["N", "A"]:
                    has_unbuildable = True
                    
            constructibilite_plu = f"Mixte ({', '.join(parts)})"
            if has_unbuildable:
                conclusion = "Défavorable (Partiellement)"
                details.append("Attention: Une partie du terrain est en zone Agricole ou Naturelle")
        elif len(zonage_enrichi) == 1:
            # Cas mono-zone (standard)
            dominant_code = zones_codes[0] if zones_codes else None
            if dominant_code == "U":
                constructibilite_plu = "Constructible (Zone U)"
            elif dominant_code == "AU":
                constructibilite_plu = "A Urbaniser (Zone AU)"
            elif dominant_code == "N":
                constructibilite_plu = "Non Constructible (Zone N)"
                conclusion = "Défavorable"
                details.append("Zone non constructible (N)")
            elif dominant_code == "A":
                constructibilite_plu = "Agricole (Zone A)"
                conclusion = "Défavorable"
                details.append("Zone Agricole (A)")
            elif dominant_code == "INFO_DOC":
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
            "zonage": [z["properties"] for z in zonage_enrichi],
            "risques": [{"libelle": r.get("libelle_risque_long"), "niveau": r.get("niveau_risque")} for r in risques],
            "is_built": is_built,
            "synthese": {
                "constructibilite": constructibilite_plu,
                "conclusion": conclusion,
                "points_vigilance": details
            }
        }

faisabilite_service = FaisabiliteService()
