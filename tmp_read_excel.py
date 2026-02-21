import pandas as pd
import json

file_path = r"C:\Users\MDO SERVICES\Documents\github\prospection\prospection-1\tmp_commerce_repos\crm\2 MATRICE DE PRETURI MARMANDE 28.11.2025 - Larox Franta complet fara OSB cabane.xlsx"

try:
    xl = pd.ExcelFile(file_path)
    output = {}
    for sheet in xl.sheet_names:
        df = xl.parse(sheet, nrows=5)
        # Convert all standard datetime objects and other complex types to string for serialization
        df.columns = df.columns.astype(str)
        df = df.astype(str)
        output[str(sheet)] = {
            "columns": list(df.columns),
            "sample_data": df.head(2).to_dict(orient="records")
        }

    with open(r"C:\Users\MDO SERVICES\Documents\github\prospection\prospection-1\tmp_excel_out.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("Extraction OK.")
except Exception as e:
    import traceback
    traceback.print_exc()
