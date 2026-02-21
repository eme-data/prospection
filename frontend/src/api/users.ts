import { fetchJSON } from './index';
import { User } from '../contexts/AuthContext';

export interface UserCreatePayload {
    email: string;
    password?: string;
    full_name: string;
    role: string;
    module_faisabilite: boolean;
    module_commerce: boolean;
    module_sav: boolean;
    module_conges: boolean;
    module_communication?: boolean;
    manager_id?: string;
    solde_conges?: number;
}

export interface UserUpdatePayload extends Partial<UserCreatePayload> { }

export const getUsers = async (): Promise<User[]> => {
    return await fetchJSON('/api/auth/users');
};

export const createUser = async (payload: UserCreatePayload): Promise<User> => {
    return await fetchJSON('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
};

export const updateUser = async (id: string, payload: UserUpdatePayload): Promise<void> => {
    await fetchJSON(`/api/auth/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
};

export const deleteUser = async (id: string): Promise<void> => {
    await fetchJSON(`/api/auth/users/${id}`, {
        method: 'DELETE',
    });
};
