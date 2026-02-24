import sys
import os
from sqlalchemy import create_engine, text

# Ajouter le répertoire parent au path pour pouvoir importer les modules de l'application
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def main():
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        print("Ajout de la colonne module_autobot...")
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN module_autobot BOOLEAN DEFAULT FALSE;"))
            print("OK.")
        except Exception as e:
            print("Probablement déjà existant : ", e)
            
        print("Ajout de la colonne module_secondaryBrain...")
        try:
            # En SQLite/Postgres les guillemets peuvent être nécessaires selon la casse, ici on met tout en minuscule pour être sûr
            conn.execute(text("ALTER TABLE users ADD COLUMN \"module_secondaryBrain\" BOOLEAN DEFAULT TRUE;"))
            print("OK.")
        except Exception as e:
            print("Probablement déjà existant : ", e)
            
        conn.commit()
        print("Mise à jour de la base de données terminée.")

if __name__ == "__main__":
    main()
