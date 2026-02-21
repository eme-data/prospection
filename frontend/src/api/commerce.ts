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
