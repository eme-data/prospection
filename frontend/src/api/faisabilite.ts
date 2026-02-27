import { fetchJSON } from './index';

// ========== FAVORIS ==========

export interface ApiFavorite {
    id: string;
    parcelle_id: string;
    parcelle: any;              // GeoJSON feature
    note?: string | null;
    addedAt: string;
    transactions?: any[] | null;
}

export interface AddFavoritePayload {
    parcelle_id: string;
    parcelle_json: any;
    note?: string;
    transactions_json?: any[];
}

export const getFavorites = (): Promise<ApiFavorite[]> =>
    fetchJSON('/api/faisabilite/favorites', { silent: true });

export const addFavorite = (data: AddFavoritePayload): Promise<{ id: string; added_at: string; already_exists?: boolean }> =>
    fetchJSON('/api/faisabilite/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

export const updateFavoriteNote = (id: string, note: string | null): Promise<{ success: boolean }> =>
    fetchJSON(`/api/faisabilite/favorites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
    });

export const deleteFavorite = (id: string): Promise<{ success: boolean }> =>
    fetchJSON(`/api/faisabilite/favorites/${id}`, { method: 'DELETE' });


// ========== PROJETS ==========

export interface ApiProject {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    status: 'active' | 'archived' | 'completed';
    parcelles: string[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateProjectPayload {
    name: string;
    description?: string;
    color?: string;
    status?: string;
    parcelles_json?: string[];
}

export interface UpdateProjectPayload {
    name?: string;
    description?: string;
    color?: string;
    status?: string;
    parcelles_json?: string[];
}

export const getProjects = (): Promise<ApiProject[]> =>
    fetchJSON('/api/faisabilite/projects', { silent: true });

export const createProject = (data: CreateProjectPayload): Promise<ApiProject> =>
    fetchJSON('/api/faisabilite/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

export const updateProject = (id: string, data: UpdateProjectPayload): Promise<ApiProject> =>
    fetchJSON(`/api/faisabilite/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

export const deleteProject = (id: string): Promise<{ success: boolean }> =>
    fetchJSON(`/api/faisabilite/projects/${id}`, { method: 'DELETE' });


// ========== HISTORIQUE DE RECHERCHE ==========

export interface ApiSearchHistory {
    id: string;
    query: string;
    address: any;
    filters?: any | null;
    timestamp: string;
}

export interface AddHistoryPayload {
    query: string;
    address_json: any;
    filters_json?: any;
}

export const getSearchHistory = (): Promise<ApiSearchHistory[]> =>
    fetchJSON('/api/faisabilite/history', { silent: true });

export const addSearchHistory = (data: AddHistoryPayload): Promise<{ id: string; searched_at: string }> =>
    fetchJSON('/api/faisabilite/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

export const deleteSearchHistory = (id: string): Promise<{ success: boolean }> =>
    fetchJSON(`/api/faisabilite/history/${id}`, { method: 'DELETE' });
