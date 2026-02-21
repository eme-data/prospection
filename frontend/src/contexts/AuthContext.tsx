import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export interface User {
    id: string;
    email: string;
    full_name?: string;
    role?: string;
    modules?: {
        faisabilite: boolean;
        commerce?: boolean;
        sav?: boolean;
        conges?: boolean;
        communication?: boolean;
    };
    solde_conges?: number;
    manager_id?: string;
}

interface AuthContextType {
    isAuthenticated: boolean;
    token: string | null;
    user: User | null;
    login: (token: string, userData?: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('prospection_token'));
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('prospection_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const isAuthenticated = !!token;

    const login = (newToken: string, userData?: User) => {
        setToken(newToken);
        localStorage.setItem('prospection_token', newToken);
        if (userData) {
            setUser(userData);
            localStorage.setItem('prospection_user', JSON.stringify(userData));
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('prospection_token');
        localStorage.removeItem('prospection_user');
    };

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
