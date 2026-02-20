import { fetchJSON } from './index';

export interface Conge {
    id: string;
    user_id: string;
    date_debut: string;
    date_fin: string;
    type_conge: string;
    statut: 'en_attente' | 'approuve' | 'refuse';
    commentaire?: string;
    date_demande: string;
}

export interface CongeCreatePayload {
    date_debut: string;
    date_fin: string;
    type_conge: string;
    commentaire?: string;
}

export interface UserCongesData {
    solde: number;
    historique: Conge[];
}

export const getMyConges = async (): Promise<UserCongesData> => {
    return await fetchJSON('/api/conges/me');
};

export const getTeamConges = async (): Promise<Conge[]> => {
    return await fetchJSON('/api/conges/team');
};

export const createConge = async (payload: CongeCreatePayload): Promise<{ message: string, conge: Conge }> => {
    return await fetchJSON('/api/conges/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
};

export const updateCongeStatut = async (id: string, statut: 'approuve' | 'refuse'): Promise<void> => {
    await fetchJSON(`/api/conges/${id}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
    });
};
