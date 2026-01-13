"""
API de Prospection Foncière
Agrège les données opendata françaises pour la prospection foncière
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
from typing import Optional
from pydantic import BaseModel

app = FastAPI(
    title="Prospection Foncière API",
    description="API pour la prospection foncière utilisant les données opendata françaises",
    version="1.0.0"
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
