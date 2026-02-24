import asyncio
import json
from app.http_client import cadastre_client

async def run():
    url = "/bundler/cadastre-etalab/communes/32331/geojson/parcelles"
    try:
        data = await cadastre_client.get(url)
        if "features" in data and len(data["features"]) > 0:
            with open("dump_parcelles.json", "w") as f:
                json.dump([feat["properties"] for feat in data["features"][:10]], f, indent=2)
            print("Dump done.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
