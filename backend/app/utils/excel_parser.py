import pandas as pd
from typing import List, Dict, Any
from io import BytesIO

class ExcelCatalogueParser:
    def __init__(self, file_bytes: bytes):
        self.xl = pd.ExcelFile(BytesIO(file_bytes))
        self.errors = []
        self.stats = {
            "materials_imported": 0,
            "articles_imported": 0,
            "compositions_imported": 0
        }

    def parse_materials(self) -> List[Dict[str, Any]]:
        """
        Analyse l'onglet 'MATERIAUX' pour extraire les matériaux d'achat.
        Dans la matrice Marmande, la feuille 'MATERIAUX' contient de nombreuses colonnes avec des dates.
        On utilise les colonnes de la dernière date ou les identifiants clés.
        """
        materials = []
        if "MATERIAUX" not in self.xl.sheet_names:
            self.errors.append("Onglet 'MATERIAUX' introuvable.")
            return materials

        df = self.xl.parse("MATERIAUX", header=1) # The header is likely on row 1 (0-indexed) or 2.
        
        # Le format exact est complexe, souvent la première colonne est "Liste déroulante" et la seconde "DESCIPTION"
        # On va chercher les lignes qui ont une désignation pour créer un Material
        df = df.dropna(subset=[df.columns[0]])
        for index, row in df.iterrows():
            designation = str(row.iloc[0]).strip()
            if not designation or designation.lower() == "liste déroulante" or designation.lower() == "nan":
                continue
            
            # Essayer de trouver une unité et un prix en parcourant les colonnes (souvent colonne 4=Unité, 6=Prix unitaire)
            unit = "u"
            price = 0.0
            try:
                # Based on our analysis, "Unnamed: 4" or index 4 is Unit, "Unnamed: 6" is Price in Euro
                if len(row) > 4:
                    unit_val = str(row.iloc[4]).strip()
                    if unit_val and unit_val.lower() != "nan":
                        unit = unit_val[:10]
                if len(row) > 6:
                    price_val = row.iloc[6]
                    if pd.notnull(price_val):
                        price = float(price_val)
            except Exception as e:
                pass # Fallback to defaults
                
            materials.append({
                "code": f"MAT-{index}",
                "name_fr": designation,
                "unit": unit,
                "internal_price": price
            })
            self.stats["materials_imported"] += 1
            
        return materials

    def parse_articles(self) -> List[Dict[str, Any]]:
        """
        Analyse l'onglet 'ARTICLE'.
        """
        articles = []
        if "ARTICLE" not in self.xl.sheet_names:
            self.errors.append("Onglet 'ARTICLE' introuvable.")
            return articles

        df = self.xl.parse("ARTICLE")
        # Columns: Liste déroulante, ARTICLES, ID, U, PRIX, MAT, MO, 0.3, 0.1
        for index, row in df.iterrows():
            designation = str(row.get("ARTICLES", "")).strip()
            if designation == "nan" or not designation:
                designation = str(row.iloc[0]).strip() # fallback Liste déroulante
            
            if designation.lower() in ("nan", "", "articles", "liste déroulante"):
                continue
                
            unit = str(row.get("U", "u")).strip()
            if unit == "nan": unit = "u"
            
            # Temps de main d'oeuvre estimé: MO total / Tarif horaire (souvent 22€)
            mo_cost = 0.0
            try:
                mo_cost = float(row.get("MO", 0.0))
            except:
                pass
                
            estimated_time = mo_cost / 22.0 # Approximation

            articles.append({
                "code": f"ART-{index}",
                "name_fr": designation,
                "unit": unit[:10],
                "installation_time": estimated_time
            })
            self.stats["articles_imported"] += 1
            
        return articles

    def parse_compositions(self) -> List[Dict[str, Any]]:
        """
        Analyse l'onglet 'COMPOSITION'.
        """
        compositions = []
        if "COMPOSITION" not in self.xl.sheet_names:
            self.errors.append("Onglet 'COMPOSITION' introuvable.")
            return compositions

        df = self.xl.parse("COMPOSITION")
        for index, row in df.iterrows():
            designation = str(row.get("COMPOSITION", "")).strip()
            if designation == "nan" or not designation:
                designation = str(row.iloc[0]).strip()
            
            if designation.lower() in ("nan", "", "composition", "liste déroulante"):
                continue
                
            unit = str(row.get("Unité", "u")).strip()
            if unit == "nan": unit = "u"
            
            compositions.append({
                "code": f"COMP-{index}",
                "name_fr": designation,
                "unit": unit[:10]
            })
            self.stats["compositions_imported"] += 1
            
        return compositions

def run_import(file_bytes: bytes) -> Dict[str, Any]:
    parser = ExcelCatalogueParser(file_bytes)
    
    # 1. Extraire les données brutes
    materials_data = parser.parse_materials()
    articles_data = parser.parse_articles()
    compositions_data = parser.parse_compositions()
    
    # Retourne les données a injecter dans la BDD par le routeur
    return {
        "success": len(parser.errors) == 0,
        "errors": parser.errors,
        "stats": parser.stats,
        "data": {
            "materials": materials_data,
            "articles": articles_data,
            "compositions": compositions_data
        }
    }
