import sys
import os

# Ajouter le backend au sys.path de Python pour pouvoir importer l'application
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy.orm import Session
from app.database import engine, get_db
from app.models.user import Base, User
from app.auth import get_password_hash

def main():
    print("Initialisation de la base de données...")
    Base.metadata.create_all(bind=engine)
    
    email = input("Email de l'administrateur : ")
    password = input("Mot de passe : ")
    full_name = input("Nom complet : ")
    
    db: Session = next(get_db())
    try:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"L'utilisateur {email} existe déjà.")
            return

        is_first = db.query(User).count() == 0

        new_user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role="admin" if is_first else "user"
        )
        
        db.add(new_user)
        db.commit()
        print(f"Utilisateur {email} créé avec succès en tant que {new_user.role} !")
    finally:
        db.close()

if __name__ == "__main__":
    main()
