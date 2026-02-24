import asyncio
import json
from app.services.faisabilite import faisabilite_service

async def run():
    report = await faisabilite_service.generate_report("323310000A0485")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    import logging
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("app.http_client").setLevel(logging.WARNING)
    asyncio.run(run())
