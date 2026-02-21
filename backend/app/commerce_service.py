"""
Service de calcul de prix pour le module Commerce
Logique métier pour calculer les prix des articles et compositions
"""

from typing import Dict
from sqlalchemy.orm import Session

from app.models.commerce import Material, Article, Composition, CompositionItemType


class CommercePriceCalculator:
    """Service de calcul automatique des prix (basé sur des floats)"""
    
    @staticmethod
    def calculate_article_price(article: Article, db: Session) -> Dict[str, float]:
        """
        Calculer le prix total d'un article
        
        Prix = (Coût matériaux + Coût MO) × (1 + overhead) × (1 + margin)
        """
        material_cost = 0.0
        
        for am in article.materials:
            material = db.query(Material).filter(Material.id == am.material_id).first()
            if material:
                quantity_with_waste = am.quantity * (1 + am.waste_percent)
                cost = material.price_eur * quantity_with_waste
                material_cost += cost
        
        total_cost = material_cost + article.labor_cost
        
        price_with_overhead = total_cost * (1 + article.overhead)
        total_price = price_with_overhead * (1 + article.margin)
        
        return {
            "material_cost": round(material_cost, 2),
            "total_cost": round(total_cost, 2),
            "total_price": round(total_price, 2)
        }
    
    @staticmethod
    def calculate_composition_price(composition: Composition, db: Session) -> Dict[str, float]:
        """
        Calculer le prix total d'une composition
        """
        total_cost = 0.0
        
        for item in composition.items:
            if item.item_type == CompositionItemType.MATERIAL:
                material = db.query(Material).filter(Material.id == item.item_id).first()
                if material:
                    cost = material.price_eur * item.quantity
                    total_cost += cost
            elif item.item_type == CompositionItemType.ARTICLE:
                article = db.query(Article).filter(Article.id == item.item_id).first()
                if article:
                    cost = article.total_price * item.quantity
                    total_cost += cost
        
        price_with_overhead = total_cost * (1 + composition.overhead)
        total_price = price_with_overhead * (1 + composition.margin)
        
        return {
            "total_cost": round(total_cost, 2),
            "total_price": round(total_price, 2)
        }
    
    @staticmethod
    def calculate_service_margin(price_net: float, price_gross: float) -> float:
        """Calculer la marge d'un service"""
        return round(price_gross - price_net, 2)
