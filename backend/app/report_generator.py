"""
Générateur de rapports PDF professionnels pour la prospection foncière
"""
import io
from datetime import datetime
from typing import List, Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    PageBreak,
    Image as RLImage,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

def generate_prospection_report(
    project_name: str,
    code_insee: str,
    commune_name: str,
    stats: Dict[str, Any],
    parcelles: List[Dict[str, Any]],
    filters: Optional[Dict[str, Any]] = None,
) -> bytes:
    """
    Génère un rapport PDF de prospection foncière

    Args:
        project_name: Nom du projet
        code_insee: Code INSEE de la commune
        commune_name: Nom de la commune
        stats: Statistiques DVF
        parcelles: Liste des parcelles
        filters: Filtres appliqués

    Returns:
        bytes: Contenu du PDF
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
    )

    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=12,
        spaceBefore=12,
    )
    normal_style = styles['Normal']

    # Contenu du document
    story = []

    # Page de titre
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("Rapport de Prospection Foncière", title_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(f"<b>{project_name}</b>", ParagraphStyle(
        'ProjectName',
        parent=normal_style,
        fontSize=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#374151'),
    )))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f"{commune_name} ({code_insee})",
        ParagraphStyle(
            'CommuneName',
            parent=normal_style,
            fontSize=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#6b7280'),
        )
    ))
    story.append(Spacer(1, 1*cm))

    # Date de génération
    current_date = datetime.now().strftime('%d/%m/%Y à %H:%M')
    story.append(Paragraph(
        f"Généré le {current_date}",
        ParagraphStyle(
            'Date',
            parent=normal_style,
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#9ca3af'),
        )
    ))

    story.append(PageBreak())

    # Synthèse
    story.append(Paragraph("Synthèse du marché", heading_style))
    story.append(Spacer(1, 0.3*cm))

    if stats and stats.get('statistiques'):
        stat_data = stats['statistiques']
        nb_transactions = stats.get('nb_transactions', 0)

        # Tableau des statistiques clés
        stats_table_data = [
            ['Indicateur', 'Valeur'],
            ['Nombre de transactions', str(nb_transactions)],
            ['Prix moyen', format_currency(stat_data.get('prix_moyen'))],
            ['Prix médian', format_currency(stat_data.get('prix_median'))],
            ['Prix minimum', format_currency(stat_data.get('prix_min'))],
            ['Prix maximum', format_currency(stat_data.get('prix_max'))],
            ['Surface moyenne', f"{int(stat_data.get('surface_moyenne', 0))} m²" if stat_data.get('surface_moyenne') else 'N/A'],
            ['Prix/m² moyen', format_currency(stat_data.get('prix_m2_moyen'))],
            ['Prix/m² minimum', format_currency(stat_data.get('prix_m2_min'))],
            ['Prix/m² maximum', format_currency(stat_data.get('prix_m2_max'))],
        ]

        stats_table = Table(stats_table_data, colWidths=[8*cm, 6*cm])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')]),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ]))
        story.append(stats_table)
        story.append(Spacer(1, 1*cm))

        # Évolution des prix
        if stats.get('evolution') and len(stats['evolution']) > 0:
            story.append(Paragraph("Évolution du marché", heading_style))
            story.append(Spacer(1, 0.3*cm))

            evolution_data = [['Année', 'Nb Transactions', 'Prix Moyen', 'Prix/m² Moyen']]
            for evo in stats['evolution']:
                evolution_data.append([
                    evo['annee'],
                    str(evo['nb_transactions']),
                    format_currency(evo.get('prix_moyen')),
                    format_currency(evo.get('prix_m2_moyen')),
                ])

            evolution_table = Table(evolution_data, colWidths=[3*cm, 3.5*cm, 3.5*cm, 3.5*cm])
            evolution_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')]),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ]))
            story.append(evolution_table)
            story.append(Spacer(1, 1*cm))

        # Répartition par type
        if stats.get('repartition_types'):
            story.append(Paragraph("Répartition par type de bien", heading_style))
            story.append(Spacer(1, 0.3*cm))

            types_data = [['Type de bien', 'Nombre de transactions', 'Pourcentage']]
            total = sum(stats['repartition_types'].values())
            for type_bien, count in stats['repartition_types'].items():
                percentage = (count / total * 100) if total > 0 else 0
                types_data.append([
                    type_bien or 'Non spécifié',
                    str(count),
                    f"{percentage:.1f}%"
                ])

            types_table = Table(types_data, colWidths=[6*cm, 4*cm, 3*cm])
            types_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')]),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ]))
            story.append(types_table)

    story.append(PageBreak())

    # Filtres appliqués
    if filters:
        story.append(Paragraph("Critères de recherche", heading_style))
        story.append(Spacer(1, 0.3*cm))

        filter_items = []
        if filters.get('typeLocal'):
            filter_items.append(f"• Type de bien : {filters['typeLocal']}")
        if filters.get('prixMin'):
            filter_items.append(f"• Prix minimum : {format_currency(filters['prixMin'])}")
        if filters.get('prixMax'):
            filter_items.append(f"• Prix maximum : {format_currency(filters['prixMax'])}")
        if filters.get('surfaceMin'):
            filter_items.append(f"• Surface minimum : {filters['surfaceMin']} m²")
        if filters.get('surfaceMax'):
            filter_items.append(f"• Surface maximum : {filters['surfaceMax']} m²")
        if filters.get('anneeMin'):
            filter_items.append(f"• Année minimum : {filters['anneeMin']}")
        if filters.get('anneeMax'):
            filter_items.append(f"• Année maximum : {filters['anneeMax']}")

        if filter_items:
            for item in filter_items:
                story.append(Paragraph(item, normal_style))
                story.append(Spacer(1, 0.2*cm))
        else:
            story.append(Paragraph("Aucun filtre appliqué", normal_style))

        story.append(Spacer(1, 1*cm))

    # Liste des parcelles
    if parcelles and len(parcelles) > 0:
        story.append(Paragraph(f"Parcelles sélectionnées ({len(parcelles)})", heading_style))
        story.append(Spacer(1, 0.3*cm))

        parcelles_data = [['ID', 'Section', 'Numéro', 'Surface (m²)']]
        for p in parcelles[:50]:  # Limiter à 50 parcelles pour ne pas surcharger
            props = p.get('properties', {})
            parcelles_data.append([
                props.get('id', 'N/A')[:20],
                props.get('section', 'N/A'),
                props.get('numero', 'N/A'),
                str(int(props.get('contenance', 0))) if props.get('contenance') else 'N/A',
            ])

        if len(parcelles) > 50:
            story.append(Paragraph(
                f"<i>Affichage des 50 premières parcelles sur {len(parcelles)} au total</i>",
                ParagraphStyle(
                    'Note',
                    parent=normal_style,
                    fontSize=9,
                    textColor=colors.HexColor('#6b7280'),
                    spaceAfter=12,
                )
            ))

        parcelles_table = Table(parcelles_data, colWidths=[6*cm, 3*cm, 3*cm, 3*cm])
        parcelles_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')]),
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ]))
        story.append(parcelles_table)

    # Pied de page
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph(
        "─" * 60,
        ParagraphStyle(
            'Separator',
            parent=normal_style,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#d1d5db'),
        )
    ))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "Rapport généré par Prospection Foncière - Données issues de sources ouvertes",
        ParagraphStyle(
            'Footer',
            parent=normal_style,
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#9ca3af'),
        )
    ))

    # Génération du PDF
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def format_currency(value: Optional[float]) -> str:
    """Formate une valeur en euros"""
    if value is None:
        return 'N/A'
    return f"{int(value):,} €".replace(',', ' ')
