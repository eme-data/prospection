import { fetchJSON } from './index';

// ========== INTERFACES ==========

export interface Material {
    id: string;
    code: string;
    name_fr: string;
    name_ro?: string;
    description?: string;
    unit: string;
    price_eur: number;
    price_lei?: number;
    supplier?: string;
    price_date: string;
    is_active: string;
}

export interface Service {
    id: string;
    code: string;
    name: string;
    description?: string;
    unit: string;
    price_net: number;
    price_gross: number;
    margin: number;
    is_active: boolean;
}

export interface ArticleMaterial {
    id?: string;
    material_id: string;
    quantity: number;
    waste_percent: number;
    material?: Material;
}

export interface Article {
    id: string;
    code: string;
    name: string;
    description?: string;
    unit: string;
    labor_cost: number;
    margin: number;
    overhead: number;
    material_cost: number;
    total_price: number;
    materials: ArticleMaterial[];
    is_active: boolean;
}

export interface CompositionItem {
    id?: string;
    composition_id: string;
    item_type: 'material' | 'article';
    item_id: string;
    quantity: number;
}

export interface Composition {
    id: string;
    code: string;
    name: string;
    description?: string;
    unit: string;
    margin: number;
    overhead: number;
    total_price: number;
    is_active: boolean;
    items: CompositionItem[];
}

export interface QuoteItem {
    id?: string;
    quote_id?: string;
    item_type: 'service' | 'material' | 'article' | 'composition' | 'custom';
    item_reference_id?: string;
    name: string;
    description?: string;
    quantity: number;
    unit_price_ht: number;
    total_price_ht?: number;
}

export interface Client {
    id: string;
    client_type: 'prospect' | 'client' | 'partner';
    company_name: string;
    siret?: string;
    vat_number?: string;
    contact_first_name?: string;
    contact_last_name?: string;
    contact_email?: string;
    contact_phone?: string;
    address_line1?: string;
    address_line2?: string;
    postal_code?: string;
    city?: string;
    country: string;
    notes?: string;
    is_active: boolean;
}

export interface Quote {
    id: string;
    quote_number: string;
    client_id: string;
    title: string;
    description?: string;
    status: 'draft' | 'sent' | 'accepted' | 'rejected';
    total_ht: number;
    total_ttc: number;
    tva_rate: number;
    validity_days: number;
    date_created: string;
    created_at: string;
    updated_at: string;
    items: QuoteItem[];
}

// ========== HISTORIQUE ANALYSES DEVIS ==========

export interface FichierInfo {
    name: string;
    size_bytes: number;
}

export interface SavedAnalysisSummary {
    id: string;
    nom_projet: string | null;
    created_at: string;
    fichiers_info: FichierInfo[];
    nb_devis: number;
}

export interface SavedAnalysisFull extends SavedAnalysisSummary {
    result: any;
}

export const saveAnalysis = (
    nomProjet: string | null,
    fichiersInfo: FichierInfo[],
    resultJson: any,
): Promise<{ id: string; created_at: string }> =>
    fetchJSON('/api/commerce/analyse-devis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom_projet: nomProjet, fichiers_info: fichiersInfo, result_json: resultJson }),
    });

export const getAnalyses = (
    limit = 20,
    offset = 0,
): Promise<{ items: SavedAnalysisSummary[]; total: number }> =>
    fetchJSON(`/api/commerce/analyse-devis/history?limit=${limit}&offset=${offset}`);

export const getAnalysis = (id: string): Promise<SavedAnalysisFull> =>
    fetchJSON(`/api/commerce/analyse-devis/history/${id}`);

export const deleteAnalysis = (id: string): Promise<{ success: boolean }> =>
    fetchJSON(`/api/commerce/analyse-devis/history/${id}`, { method: 'DELETE' });


// ========== ANALYSE DEVIS ==========

export const analyzeQuotes = async (files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
        formData.append('files', file);
    });

    const token = localStorage.getItem('prospection_token');
    const headers = new Headers();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch('/api/commerce/analyse-devis/', {
        method: 'POST',
        headers, // Do NOT set Content-Type to multipart/form-data, fetch does this automatically with boundaries
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

// ========== CATALOGUE CRM API ==========

export const importCatalogue = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('prospection_token');
    const headers = new Headers();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch('/api/commerce/import', {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

// Materials
export const getMaterials = () => fetchJSON<Material[]>('/api/commerce/materials');
export const getMaterial = (id: string) => fetchJSON<Material>(`/api/commerce/materials/${id}`);
export const createMaterial = (data: Partial<Material>) =>
    fetchJSON<Material>('/api/commerce/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateMaterial = (id: string, data: Partial<Material>) =>
    fetchJSON<Material>(`/api/commerce/materials/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteMaterial = (id: string) =>
    fetchJSON(`/api/commerce/materials/${id}`, { method: 'DELETE' });

// Services
export const getServices = () => fetchJSON<Service[]>('/api/commerce/services');
export const getService = (id: string) => fetchJSON<Service>(`/api/commerce/services/${id}`);
export const createService = (data: Partial<Service>) =>
    fetchJSON<Service>('/api/commerce/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateService = (id: string, data: Partial<Service>) =>
    fetchJSON<Service>(`/api/commerce/services/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteService = (id: string) =>
    fetchJSON(`/api/commerce/services/${id}`, { method: 'DELETE' });

// Articles
export const getArticles = () => fetchJSON<Article[]>('/api/commerce/articles');
export const getArticle = (id: string) => fetchJSON<Article>(`/api/commerce/articles/${id}`);
export const createArticle = (data: Partial<Article>) =>
    fetchJSON<Article>('/api/commerce/articles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateArticle = (id: string, data: Partial<Article>) =>
    fetchJSON<Article>(`/api/commerce/articles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteArticle = (id: string) =>
    fetchJSON(`/api/commerce/articles/${id}`, { method: 'DELETE' });

// Compositions
export const getCompositions = () => fetchJSON<Composition[]>('/api/commerce/compositions');
export const getComposition = (id: string) => fetchJSON<Composition>(`/api/commerce/compositions/${id}`);

// Quotes
export const getQuotes = () => fetchJSON<Quote[]>('/api/commerce/quotes');
export const getQuote = (id: string) => fetchJSON<Quote>(`/api/commerce/quotes/${id}`);
export const createQuote = (data: Partial<Quote>) =>
    fetchJSON<Quote>('/api/commerce/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateQuote = (id: string, data: Partial<Quote>) =>
    fetchJSON<Quote>(`/api/commerce/quotes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

// Clients
export const getClients = () => fetchJSON<Client[]>('/api/commerce/clients');
export const createClient = (data: Partial<Client>) =>
    fetchJSON<Client>('/api/commerce/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
