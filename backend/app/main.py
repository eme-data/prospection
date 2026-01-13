"""
API de Prospection Foncière
Agrège les données opendata françaises pour la prospection foncière
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import csv
import io
import json

app = FastAPI(
    title="Prospection Foncière API",
    description="API pour la prospection foncière utilisant les données opendata françaises",
    version="2.0.0"
)

# Configuration CORS pour le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# URLs des APIs opendata
API_ADRESSE = "https://api-adresse.data.gouv.fr"
API_CADASTRE = "https://cadastre.data.gouv.fr"
API_GEO = "https://geo.api.gouv.fr"
API_DVF = "https://api.cquest.org/dvf"  # API DVF par Christian Quest
API_GEORISQUES = "https://georisques.gouv.fr/api/v1"
API_GPU = "https://apicarto.ign.fr/api/gpu"  # Géoportail de l'Urbanisme


class SearchResult(BaseModel):
    label: str
    score: float
    housenumber: Optional[str] = None
    street: Optional[str] = None
    postcode: Optional[str] = None
    citycode: Optional[str] = None
    city: Optional[str] = None
    context: Optional[str] = None
    longitude: float
    latitude: float


@app.get("/")
async def root():
    """Point d'entrée de l'API"""
    return {
        "message": "API Prospection Foncière",
        "version": "1.0.0",
        "endpoints": {
            "search_address": "/api/address/search",
            "reverse_geocode": "/api/address/reverse",
            "parcelles": "/api/cadastre/parcelles",
            "dvf": "/api/dvf/transactions",
            "communes": "/api/geo/communes"
        }
    }


@app.get("/api/address/search")
async def search_address(q: str = Query(..., min_length=3, description="Adresse à rechercher")):
    """
    Recherche d'adresse via la Base Adresse Nationale (BAN)
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_ADRESSE}/search/",
                params={"q": q, "limit": 10}
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                coords = feature.get("geometry", {}).get("coordinates", [0, 0])
                results.append({
                    "label": props.get("label", ""),
                    "score": props.get("score", 0),
                    "housenumber": props.get("housenumber"),
                    "street": props.get("street"),
                    "postcode": props.get("postcode"),
                    "citycode": props.get("citycode"),
                    "city": props.get("city"),
                    "context": props.get("context"),
                    "longitude": coords[0],
                    "latitude": coords[1]
                })

            return {"results": results}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API BAN: {str(e)}")


@app.get("/api/address/reverse")
async def reverse_geocode(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude")
):
    """
    Géocodage inverse - trouve l'adresse à partir de coordonnées
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_ADRESSE}/reverse/",
                params={"lon": lon, "lat": lat}
            )
            response.raise_for_status()
            data = response.json()

            features = data.get("features", [])
            if not features:
                return {"result": None}

            feature = features[0]
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0])

            return {
                "result": {
                    "label": props.get("label", ""),
                    "housenumber": props.get("housenumber"),
                    "street": props.get("street"),
                    "postcode": props.get("postcode"),
                    "citycode": props.get("citycode"),
                    "city": props.get("city"),
                    "longitude": coords[0],
                    "latitude": coords[1]
                }
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API BAN: {str(e)}")


@app.get("/api/cadastre/parcelles")
async def get_parcelles(
    code_insee: str = Query(..., description="Code INSEE de la commune"),
    section: Optional[str] = Query(None, description="Section cadastrale (ex: AB)"),
    numero: Optional[str] = Query(None, description="Numéro de parcelle")
):
    """
    Récupère les parcelles cadastrales d'une commune
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Construction de l'URL pour le téléchargement GeoJSON des parcelles
            url = f"{API_CADASTRE}/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"

            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            features = data.get("features", [])

            # Filtrage optionnel par section et numéro
            if section:
                features = [f for f in features if f.get("properties", {}).get("section", "").upper() == section.upper()]
            if numero:
                features = [f for f in features if f.get("properties", {}).get("numero", "") == numero]

            return {
                "type": "FeatureCollection",
                "features": features[:100]  # Limite à 100 parcelles pour performance
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Cadastre: {str(e)}")


@app.get("/api/cadastre/parcelle/{parcelle_id}")
async def get_parcelle_detail(parcelle_id: str):
    """
    Récupère les détails d'une parcelle spécifique
    Format parcelle_id: CODE_INSEE + SECTION + NUMERO (ex: 75101000AB0001)
    """
    # Extraction des composants de l'identifiant parcelle
    if len(parcelle_id) < 10:
        raise HTTPException(status_code=400, detail="Identifiant de parcelle invalide")

    code_insee = parcelle_id[:5]

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            url = f"{API_CADASTRE}/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            # Recherche de la parcelle
            for feature in data.get("features", []):
                if feature.get("properties", {}).get("id") == parcelle_id:
                    return feature

            raise HTTPException(status_code=404, detail="Parcelle non trouvée")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Cadastre: {str(e)}")


@app.get("/api/dvf/transactions")
async def get_dvf_transactions(
    code_insee: Optional[str] = Query(None, description="Code INSEE de la commune"),
    lon: Optional[float] = Query(None, description="Longitude du centre"),
    lat: Optional[float] = Query(None, description="Latitude du centre"),
    rayon: int = Query(500, description="Rayon de recherche en mètres")
):
    """
    Récupère les transactions DVF (Demandes de Valeurs Foncières)
    Utilise l'API DVF de Christian Quest
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            params = {}

            if code_insee:
                params["code_commune"] = code_insee
            elif lon and lat:
                params["lon"] = lon
                params["lat"] = lat
                params["dist"] = rayon
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Veuillez fournir soit un code_insee, soit des coordonnées (lon, lat)"
                )

            response = await client.get(API_DVF, params=params)
            response.raise_for_status()
            data = response.json()

            # Transformation en GeoJSON pour affichage sur la carte
            features = []
            for transaction in data.get("resultats", [])[:200]:  # Limite à 200 transactions
                if transaction.get("longitude") and transaction.get("latitude"):
                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                float(transaction.get("longitude", 0)),
                                float(transaction.get("latitude", 0))
                            ]
                        },
                        "properties": {
                            "date_mutation": transaction.get("date_mutation"),
                            "nature_mutation": transaction.get("nature_mutation"),
                            "valeur_fonciere": transaction.get("valeur_fonciere"),
                            "adresse": transaction.get("adresse_nom_voie"),
                            "code_postal": transaction.get("code_postal"),
                            "commune": transaction.get("nom_commune"),
                            "type_local": transaction.get("type_local"),
                            "surface_reelle_bati": transaction.get("surface_reelle_bati"),
                            "nombre_pieces": transaction.get("nombre_pieces_principales"),
                            "surface_terrain": transaction.get("surface_terrain")
                        }
                    })

            return {
                "type": "FeatureCollection",
                "features": features,
                "count": len(features)
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")


@app.get("/api/geo/communes")
async def search_communes(
    nom: Optional[str] = Query(None, description="Nom de la commune"),
    code_postal: Optional[str] = Query(None, description="Code postal"),
    code_departement: Optional[str] = Query(None, description="Code département")
):
    """
    Recherche de communes via l'API Géo
    """
    async with httpx.AsyncClient() as client:
        try:
            params = {"fields": "nom,code,codesPostaux,centre,contour,population,departement"}

            if nom:
                params["nom"] = nom
            if code_postal:
                params["codePostal"] = code_postal
            if code_departement:
                params["codeDepartement"] = code_departement

            response = await client.get(f"{API_GEO}/communes", params=params)
            response.raise_for_status()
            communes = response.json()

            return {
                "communes": communes[:20]  # Limite à 20 résultats
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Géo: {str(e)}")


@app.get("/api/geo/commune/{code_insee}")
async def get_commune(code_insee: str):
    """
    Récupère les détails d'une commune par son code INSEE
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_GEO}/communes/{code_insee}",
                params={"fields": "nom,code,codesPostaux,centre,contour,population,departement,region,surface"}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Géo: {str(e)}")


@app.get("/api/geo/departements")
async def get_departements():
    """
    Liste tous les départements français
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_GEO}/departements",
                params={"fields": "nom,code,codeRegion"}
            )
            response.raise_for_status()
            return {"departements": response.json()}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Géo: {str(e)}")


# ============== RISQUES NATURELS (GEORISQUES) ==============

@app.get("/api/risques/commune/{code_insee}")
async def get_risques_commune(code_insee: str):
    """
    Récupère les risques naturels et technologiques d'une commune
    via l'API Géorisques
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Récupération des risques
            response = await client.get(
                f"{API_GEORISQUES}/gaspar/risques",
                params={"code_insee": code_insee}
            )
            response.raise_for_status()
            data = response.json()

            risques = []
            for item in data.get("data", []):
                risques.append({
                    "code": item.get("code_risque"),
                    "libelle": item.get("libelle_risque_long"),
                    "niveau": item.get("niveau_risque"),
                })

            return {
                "code_insee": code_insee,
                "risques": risques,
                "count": len(risques)
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Géorisques: {str(e)}")


@app.get("/api/risques/parcelle")
async def get_risques_parcelle(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude")
):
    """
    Récupère les risques pour une localisation précise
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Risques naturels autour du point
            response = await client.get(
                f"{API_GEORISQUES}/gaspar/risques",
                params={
                    "latlon": f"{lat},{lon}",
                    "rayon": 1000
                }
            )
            response.raise_for_status()
            data = response.json()

            risques = []
            for item in data.get("data", []):
                risques.append({
                    "code": item.get("code_risque"),
                    "libelle": item.get("libelle_risque_long"),
                    "niveau": item.get("niveau_risque"),
                    "commune": item.get("libelle_commune"),
                })

            return {
                "longitude": lon,
                "latitude": lat,
                "risques": risques,
                "count": len(risques)
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Géorisques: {str(e)}")


@app.get("/api/risques/inondation")
async def get_risques_inondation(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude")
):
    """
    Récupère les zones inondables autour d'un point
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{API_GEORISQUES}/gaspar/azi",
                params={
                    "latlon": f"{lat},{lon}",
                    "rayon": 500
                }
            )
            response.raise_for_status()
            data = response.json()

            return {
                "longitude": lon,
                "latitude": lat,
                "zones_inondables": data.get("data", []),
                "count": len(data.get("data", []))
            }
        except httpx.HTTPError as e:
            # Retourner une réponse vide si pas de données
            return {
                "longitude": lon,
                "latitude": lat,
                "zones_inondables": [],
                "count": 0
            }


# ============== PLU / URBANISME (GEOPORTAIL) ==============

@app.get("/api/urbanisme/zonage")
async def get_zonage_plu(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude")
):
    """
    Récupère le zonage PLU/PLUi pour une localisation
    via l'API Carto IGN (Géoportail de l'Urbanisme)
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Point au format WKT
            geom = f"POINT({lon} {lat})"

            response = await client.get(
                f"{API_GPU}/zone-urba",
                params={"geom": geom}
            )
            response.raise_for_status()
            data = response.json()

            zones = []
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                zones.append({
                    "libelle": props.get("libelle"),
                    "libelong": props.get("libelong"),
                    "typezone": props.get("typezone"),
                    "destdomi": props.get("destdomi"),
                    "nomfic": props.get("nomfic"),
                    "urlfic": props.get("urlfic"),
                    "partition": props.get("partition"),
                })

            return {
                "longitude": lon,
                "latitude": lat,
                "zonages": zones,
                "count": len(zones)
            }
        except httpx.HTTPError as e:
            return {
                "longitude": lon,
                "latitude": lat,
                "zonages": [],
                "count": 0,
                "error": str(e)
            }


@app.get("/api/urbanisme/prescriptions")
async def get_prescriptions_plu(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude")
):
    """
    Récupère les prescriptions PLU pour une localisation
    (servitudes, emplacements réservés, etc.)
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            geom = f"POINT({lon} {lat})"

            response = await client.get(
                f"{API_GPU}/prescription-surf",
                params={"geom": geom}
            )
            response.raise_for_status()
            data = response.json()

            prescriptions = []
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                prescriptions.append({
                    "libelle": props.get("libelle"),
                    "txt": props.get("txt"),
                    "typepsc": props.get("typepsc"),
                    "stypepsc": props.get("stypepsc"),
                    "nomfic": props.get("nomfic"),
                    "urlfic": props.get("urlfic"),
                })

            return {
                "longitude": lon,
                "latitude": lat,
                "prescriptions": prescriptions,
                "count": len(prescriptions)
            }
        except httpx.HTTPError as e:
            return {
                "longitude": lon,
                "latitude": lat,
                "prescriptions": [],
                "count": 0
            }


# ============== STATISTIQUES DVF ==============

@app.get("/api/dvf/statistiques")
async def get_dvf_statistiques(
    code_insee: str = Query(..., description="Code INSEE de la commune"),
    type_local: Optional[str] = Query(None, description="Type de local (Maison, Appartement, etc.)"),
    annee_min: Optional[int] = Query(None, description="Année minimum"),
    annee_max: Optional[int] = Query(None, description="Année maximum")
):
    """
    Calcule les statistiques des transactions DVF pour une commune
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            params = {"code_commune": code_insee}

            response = await client.get(API_DVF, params=params)
            response.raise_for_status()
            data = response.json()

            transactions = data.get("resultats", [])

            # Filtrage
            if type_local:
                transactions = [t for t in transactions if t.get("type_local") == type_local]

            if annee_min or annee_max:
                filtered = []
                for t in transactions:
                    date_str = t.get("date_mutation", "")
                    if date_str:
                        try:
                            annee = int(date_str[:4])
                            if annee_min and annee < annee_min:
                                continue
                            if annee_max and annee > annee_max:
                                continue
                            filtered.append(t)
                        except (ValueError, IndexError):
                            continue
                transactions = filtered

            # Calcul des statistiques
            if not transactions:
                return {
                    "code_insee": code_insee,
                    "nb_transactions": 0,
                    "statistiques": None
                }

            valeurs = [t.get("valeur_fonciere", 0) for t in transactions if t.get("valeur_fonciere")]
            surfaces = [t.get("surface_reelle_bati", 0) for t in transactions if t.get("surface_reelle_bati")]
            prix_m2 = []

            for t in transactions:
                val = t.get("valeur_fonciere", 0)
                surf = t.get("surface_reelle_bati", 0)
                if val and surf and surf > 0:
                    prix_m2.append(val / surf)

            # Statistiques par année
            par_annee = {}
            for t in transactions:
                date_str = t.get("date_mutation", "")
                if date_str:
                    try:
                        annee = date_str[:4]
                        if annee not in par_annee:
                            par_annee[annee] = {"nb": 0, "valeurs": [], "prix_m2": []}
                        par_annee[annee]["nb"] += 1
                        if t.get("valeur_fonciere"):
                            par_annee[annee]["valeurs"].append(t["valeur_fonciere"])
                        if t.get("valeur_fonciere") and t.get("surface_reelle_bati") and t["surface_reelle_bati"] > 0:
                            par_annee[annee]["prix_m2"].append(t["valeur_fonciere"] / t["surface_reelle_bati"])
                    except (ValueError, IndexError):
                        continue

            evolution = []
            for annee in sorted(par_annee.keys()):
                stats = par_annee[annee]
                evolution.append({
                    "annee": annee,
                    "nb_transactions": stats["nb"],
                    "prix_moyen": sum(stats["valeurs"]) / len(stats["valeurs"]) if stats["valeurs"] else None,
                    "prix_m2_moyen": sum(stats["prix_m2"]) / len(stats["prix_m2"]) if stats["prix_m2"] else None,
                })

            # Types de biens
            types_count = {}
            for t in transactions:
                type_bien = t.get("type_local", "Autre") or "Autre"
                types_count[type_bien] = types_count.get(type_bien, 0) + 1

            return {
                "code_insee": code_insee,
                "nb_transactions": len(transactions),
                "statistiques": {
                    "prix_min": min(valeurs) if valeurs else None,
                    "prix_max": max(valeurs) if valeurs else None,
                    "prix_moyen": sum(valeurs) / len(valeurs) if valeurs else None,
                    "prix_median": sorted(valeurs)[len(valeurs) // 2] if valeurs else None,
                    "surface_moyenne": sum(surfaces) / len(surfaces) if surfaces else None,
                    "prix_m2_moyen": sum(prix_m2) / len(prix_m2) if prix_m2 else None,
                    "prix_m2_min": min(prix_m2) if prix_m2 else None,
                    "prix_m2_max": max(prix_m2) if prix_m2 else None,
                },
                "evolution": evolution,
                "repartition_types": types_count
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")


# ============== EXPORT DES DONNÉES ==============

@app.get("/api/export/dvf/csv")
async def export_dvf_csv(
    code_insee: str = Query(..., description="Code INSEE de la commune"),
    type_local: Optional[str] = Query(None, description="Filtrer par type de local"),
    prix_min: Optional[float] = Query(None, description="Prix minimum"),
    prix_max: Optional[float] = Query(None, description="Prix maximum"),
    surface_min: Optional[float] = Query(None, description="Surface minimum"),
    surface_max: Optional[float] = Query(None, description="Surface maximum")
):
    """
    Exporte les transactions DVF en CSV avec filtres
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(API_DVF, params={"code_commune": code_insee})
            response.raise_for_status()
            data = response.json()

            transactions = data.get("resultats", [])

            # Filtrage
            if type_local:
                transactions = [t for t in transactions if t.get("type_local") == type_local]
            if prix_min is not None:
                transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) >= prix_min]
            if prix_max is not None:
                transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) <= prix_max]
            if surface_min is not None:
                transactions = [t for t in transactions if (t.get("surface_reelle_bati") or 0) >= surface_min]
            if surface_max is not None:
                transactions = [t for t in transactions if (t.get("surface_reelle_bati") or 0) <= surface_max]

            # Génération CSV
            output = io.StringIO()
            writer = csv.writer(output, delimiter=';')

            # En-têtes
            writer.writerow([
                "Date mutation", "Nature mutation", "Valeur fonciere", "Adresse",
                "Code postal", "Commune", "Type local", "Surface bati",
                "Nombre pieces", "Surface terrain", "Longitude", "Latitude", "Prix m2"
            ])

            # Données
            for t in transactions:
                valeur = t.get("valeur_fonciere", 0) or 0
                surface = t.get("surface_reelle_bati", 0) or 0
                prix_m2 = round(valeur / surface, 2) if surface > 0 else ""

                writer.writerow([
                    t.get("date_mutation", ""),
                    t.get("nature_mutation", ""),
                    valeur,
                    t.get("adresse_nom_voie", ""),
                    t.get("code_postal", ""),
                    t.get("nom_commune", ""),
                    t.get("type_local", ""),
                    surface,
                    t.get("nombre_pieces_principales", ""),
                    t.get("surface_terrain", ""),
                    t.get("longitude", ""),
                    t.get("latitude", ""),
                    prix_m2
                ])

            output.seek(0)

            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=dvf_{code_insee}_{datetime.now().strftime('%Y%m%d')}.csv"
                }
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")


@app.get("/api/export/dvf/geojson")
async def export_dvf_geojson(
    code_insee: str = Query(..., description="Code INSEE de la commune"),
    type_local: Optional[str] = Query(None, description="Filtrer par type de local"),
    prix_min: Optional[float] = Query(None, description="Prix minimum"),
    prix_max: Optional[float] = Query(None, description="Prix maximum")
):
    """
    Exporte les transactions DVF en GeoJSON
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(API_DVF, params={"code_commune": code_insee})
            response.raise_for_status()
            data = response.json()

            transactions = data.get("resultats", [])

            # Filtrage
            if type_local:
                transactions = [t for t in transactions if t.get("type_local") == type_local]
            if prix_min is not None:
                transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) >= prix_min]
            if prix_max is not None:
                transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) <= prix_max]

            # Génération GeoJSON
            features = []
            for t in transactions:
                if t.get("longitude") and t.get("latitude"):
                    valeur = t.get("valeur_fonciere", 0) or 0
                    surface = t.get("surface_reelle_bati", 0) or 0

                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [float(t["longitude"]), float(t["latitude"])]
                        },
                        "properties": {
                            "date_mutation": t.get("date_mutation"),
                            "nature_mutation": t.get("nature_mutation"),
                            "valeur_fonciere": valeur,
                            "adresse": t.get("adresse_nom_voie"),
                            "code_postal": t.get("code_postal"),
                            "commune": t.get("nom_commune"),
                            "type_local": t.get("type_local"),
                            "surface_reelle_bati": surface,
                            "nombre_pieces": t.get("nombre_pieces_principales"),
                            "surface_terrain": t.get("surface_terrain"),
                            "prix_m2": round(valeur / surface, 2) if surface > 0 else None
                        }
                    })

            geojson = {
                "type": "FeatureCollection",
                "features": features
            }

            return StreamingResponse(
                iter([json.dumps(geojson, ensure_ascii=False, indent=2)]),
                media_type="application/geo+json",
                headers={
                    "Content-Disposition": f"attachment; filename=dvf_{code_insee}_{datetime.now().strftime('%Y%m%d')}.geojson"
                }
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")


@app.get("/api/export/parcelles/geojson")
async def export_parcelles_geojson(
    code_insee: str = Query(..., description="Code INSEE de la commune"),
    section: Optional[str] = Query(None, description="Filtrer par section cadastrale")
):
    """
    Exporte les parcelles cadastrales en GeoJSON
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            url = f"{API_CADASTRE}/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            features = data.get("features", [])

            if section:
                features = [f for f in features if f.get("properties", {}).get("section", "").upper() == section.upper()]

            geojson = {
                "type": "FeatureCollection",
                "features": features
            }

            section_suffix = f"_{section}" if section else ""

            return StreamingResponse(
                iter([json.dumps(geojson, ensure_ascii=False)]),
                media_type="application/geo+json",
                headers={
                    "Content-Disposition": f"attachment; filename=parcelles_{code_insee}{section_suffix}.geojson"
                }
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Cadastre: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
