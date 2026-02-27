"""Initial schema — toutes les tables

Revision ID: 0001
Revises:
Create Date: 2026-02-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('module_faisabilite', sa.Boolean(), nullable=True),
        sa.Column('module_commerce', sa.Boolean(), nullable=True),
        sa.Column('module_sav', sa.Boolean(), nullable=True),
        sa.Column('module_conges', sa.Boolean(), nullable=True),
        sa.Column('module_communication', sa.Boolean(), nullable=True),
        sa.Column('module_autobot', sa.Boolean(), nullable=True),
        sa.Column('module_secondaryBrain', sa.Boolean(), nullable=True),
        sa.Column('manager_id', sa.String(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('solde_conges', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_id', 'users', ['id'])

    # ── system_settings ──────────────────────────────────────
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('key'),
    )
    op.create_index('ix_system_settings_key', 'system_settings', ['key'])

    # ── social_accounts ──────────────────────────────────────
    op.create_table(
        'social_accounts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('platform', sa.String(), nullable=False),
        sa.Column('platform_user_id', sa.String(), nullable=False),
        sa.Column('access_token', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_social_accounts_id', 'social_accounts', ['id'])

    # ── posts ────────────────────────────────────────────────
    op.create_table(
        'posts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('platform', sa.String(), nullable=False),
        sa.Column('ai_model', sa.String(), nullable=False),
        sa.Column('topic', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('tone', sa.String(), nullable=True),
        sa.Column('length', sa.String(), nullable=True),
        sa.Column('include_hashtags', sa.Boolean(), nullable=True),
        sa.Column('include_emojis', sa.Boolean(), nullable=True),
        sa.Column('published_to_linkedin', sa.Boolean(), nullable=True),
        sa.Column('linkedin_post_url', sa.String(), nullable=True),
        sa.Column('published_to_facebook', sa.Boolean(), nullable=True),
        sa.Column('facebook_post_url', sa.String(), nullable=True),
        sa.Column('published_to_instagram', sa.Boolean(), nullable=True),
        sa.Column('instagram_post_url', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_posts_id', 'posts', ['id'])

    # ── conges ───────────────────────────────────────────────
    op.create_table(
        'conges',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('date_debut', sa.Date(), nullable=False),
        sa.Column('date_fin', sa.Date(), nullable=False),
        sa.Column('type_conge', sa.String(), nullable=False),
        sa.Column('statut', sa.String(), nullable=True),
        sa.Column('commentaire', sa.String(), nullable=True),
        sa.Column('date_demande', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_conges_id', 'conges', ['id'])
    op.create_index('ix_conges_user_id', 'conges', ['user_id'])

    # ── clients ──────────────────────────────────────────────
    op.create_table(
        'clients',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('client_type', sa.String(), nullable=False),
        sa.Column('company_name', sa.String(), nullable=False),
        sa.Column('siret', sa.String(), nullable=True),
        sa.Column('vat_number', sa.String(), nullable=True),
        sa.Column('contact_first_name', sa.String(), nullable=True),
        sa.Column('contact_last_name', sa.String(), nullable=True),
        sa.Column('contact_email', sa.String(), nullable=True),
        sa.Column('contact_phone', sa.String(), nullable=True),
        sa.Column('address_line1', sa.String(), nullable=True),
        sa.Column('address_line2', sa.String(), nullable=True),
        sa.Column('postal_code', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=False),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_clients_id', 'clients', ['id'])
    op.create_index('ix_clients_company_name', 'clients', ['company_name'])
    op.create_index('ix_clients_contact_email', 'clients', ['contact_email'])
    op.create_index('ix_clients_active', 'clients', ['is_active'])
    op.create_index('ix_clients_type', 'clients', ['client_type'])

    # ── materials ────────────────────────────────────────────
    op.create_table(
        'materials',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('name_fr', sa.String(), nullable=False),
        sa.Column('name_ro', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('price_eur', sa.Float(), nullable=False),
        sa.Column('price_lei', sa.Float(), nullable=True),
        sa.Column('price_date', sa.String(), nullable=True),
        sa.Column('supplier', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_materials_id', 'materials', ['id'])
    op.create_index('ix_materials_code', 'materials', ['code'], unique=True)
    op.create_index('ix_materials_active', 'materials', ['is_active'])

    # ── services ─────────────────────────────────────────────
    op.create_table(
        'services',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('price_net', sa.Float(), nullable=False),
        sa.Column('price_gross', sa.Float(), nullable=False),
        sa.Column('margin', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_services_id', 'services', ['id'])
    op.create_index('ix_services_code', 'services', ['code'], unique=True)
    op.create_index('ix_services_active', 'services', ['is_active'])

    # ── articles ─────────────────────────────────────────────
    op.create_table(
        'articles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('material_cost', sa.Float(), nullable=False),
        sa.Column('labor_cost', sa.Float(), nullable=False),
        sa.Column('margin', sa.Float(), nullable=False),
        sa.Column('overhead', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_articles_id', 'articles', ['id'])
    op.create_index('ix_articles_code', 'articles', ['code'], unique=True)
    op.create_index('ix_articles_active', 'articles', ['is_active'])

    # ── article_materials ────────────────────────────────────
    op.create_table(
        'article_materials',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('article_id', sa.String(), sa.ForeignKey('articles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('material_id', sa.String(), sa.ForeignKey('materials.id'), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('waste_percent', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_article_materials_id', 'article_materials', ['id'])
    op.create_index('ix_article_materials_article', 'article_materials', ['article_id'])

    # ── compositions ─────────────────────────────────────────
    op.create_table(
        'compositions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('margin', sa.Float(), nullable=False),
        sa.Column('overhead', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_compositions_id', 'compositions', ['id'])
    op.create_index('ix_compositions_code', 'compositions', ['code'], unique=True)
    op.create_index('ix_compositions_active', 'compositions', ['is_active'])

    # ── composition_items ────────────────────────────────────
    op.create_table(
        'composition_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('composition_id', sa.String(), sa.ForeignKey('compositions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('item_id', sa.String(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_composition_items_id', 'composition_items', ['id'])
    op.create_index('ix_composition_items_composition', 'composition_items', ['composition_id'])

    # ── quotes ───────────────────────────────────────────────
    op.create_table(
        'quotes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('quote_number', sa.String(), nullable=False),
        sa.Column('client_id', sa.String(), sa.ForeignKey('clients.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('total_ht', sa.Float(), nullable=False),
        sa.Column('total_ttc', sa.Float(), nullable=False),
        sa.Column('tva_rate', sa.Float(), nullable=False),
        sa.Column('date_created', sa.String(), nullable=True),
        sa.Column('validity_days', sa.Float(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_quotes_id', 'quotes', ['id'])
    op.create_index('ix_quotes_quote_number', 'quotes', ['quote_number'], unique=True)
    op.create_index('ix_quotes_client', 'quotes', ['client_id'])
    op.create_index('ix_quotes_status', 'quotes', ['status'])

    # ── quote_items ──────────────────────────────────────────
    op.create_table(
        'quote_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('quote_id', sa.String(), sa.ForeignKey('quotes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('item_reference_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_price_ht', sa.Float(), nullable=False),
        sa.Column('total_price_ht', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_quote_items_id', 'quote_items', ['id'])
    op.create_index('ix_quote_items_quote', 'quote_items', ['quote_id'])

    # ── devis_analyses ───────────────────────────────────────
    op.create_table(
        'devis_analyses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('nom_projet', sa.String(), nullable=True),
        sa.Column('fichiers_info', sa.Text(), nullable=False),
        sa.Column('result_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_devis_analyses_id', 'devis_analyses', ['id'])
    op.create_index('ix_devis_analyses_user_id', 'devis_analyses', ['user_id'])
    op.create_index('ix_devis_analyses_created_at', 'devis_analyses', ['created_at'])
    op.create_index('ix_devis_analyses_user_created', 'devis_analyses', ['user_id', 'created_at'])

    # ── logos_generated ──────────────────────────────────────
    op.create_table(
        'logos_generated',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_name', sa.String(), nullable=False),
        sa.Column('sector', sa.String(), nullable=True),
        sa.Column('style', sa.String(), nullable=True),
        sa.Column('colors', sa.String(), nullable=True),
        sa.Column('svg_content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_logos_generated_id', 'logos_generated', ['id'])
    op.create_index('ix_logos_generated_user_id', 'logos_generated', ['user_id'])

    # ── faisabilite_favorites ────────────────────────────────
    op.create_table(
        'faisabilite_favorites',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parcelle_id', sa.String(), nullable=False),
        sa.Column('parcelle_json', sa.Text(), nullable=False),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('transactions_json', sa.Text(), nullable=True),
        sa.Column('added_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_faisabilite_favorites_id', 'faisabilite_favorites', ['id'])
    op.create_index('ix_faisabilite_favorites_user_id', 'faisabilite_favorites', ['user_id'])

    # ── faisabilite_projects ─────────────────────────────────
    op.create_table(
        'faisabilite_projects',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('parcelles_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_faisabilite_projects_id', 'faisabilite_projects', ['id'])
    op.create_index('ix_faisabilite_projects_user_id', 'faisabilite_projects', ['user_id'])

    # ── faisabilite_history ──────────────────────────────────
    op.create_table(
        'faisabilite_history',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('query', sa.String(), nullable=False),
        sa.Column('address_json', sa.Text(), nullable=False),
        sa.Column('filters_json', sa.Text(), nullable=True),
        sa.Column('searched_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_faisabilite_history_id', 'faisabilite_history', ['id'])
    op.create_index('ix_faisabilite_history_user_id', 'faisabilite_history', ['user_id'])


def downgrade() -> None:
    op.drop_table('faisabilite_history')
    op.drop_table('faisabilite_projects')
    op.drop_table('faisabilite_favorites')
    op.drop_table('logos_generated')
    op.drop_table('devis_analyses')
    op.drop_table('quote_items')
    op.drop_table('quotes')
    op.drop_table('composition_items')
    op.drop_table('compositions')
    op.drop_table('article_materials')
    op.drop_table('articles')
    op.drop_table('services')
    op.drop_table('materials')
    op.drop_table('clients')
    op.drop_table('conges')
    op.drop_table('posts')
    op.drop_table('social_accounts')
    op.drop_table('system_settings')
    op.drop_table('users')
