import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { PortalPage } from './components/PortalPage';
import { FaisabiliteApp } from './components/FaisabiliteApp';
import { AdminUsersPage } from './components/AdminUsersPage';
import { AdminSettings } from './components/AdminSettings';
import { CongesApp } from './apps/Conges/CongesApp';
import { CommunicationApp } from './apps/Communication/CommunicationApp';

const queryClient = new QueryClient();

// Composant pour protéger les routes
const ProtectedRoute: React.FC<{ children: React.ReactNode, requiredModule?: 'faisabilite' | 'crm' | 'travaux' | 'sav' | 'conges' | 'communication' }> = ({ children, requiredModule }) => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredModule && user && !user.modules?.[requiredModule]) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

// Composant pour protéger les routes administrateur
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <Routes>
                            {/* Route publique */}
                            <Route path="/login" element={<LoginPage />} />

                            {/* Routes protégées */}
                            <Route
                                path="/"
                                element={
                                    <ProtectedRoute>
                                        <PortalPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/faisabilite"
                                element={
                                    <ProtectedRoute>
                                        <FaisabiliteApp />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/admin/users"
                                element={
                                    <AdminRoute>
                                        <AdminUsersPage />
                                    </AdminRoute>
                                }
                            />
                            <Route
                                path="/admin/settings"
                                element={
                                    <AdminRoute>
                                        <AdminSettings />
                                    </AdminRoute>
                                }
                            />

                            <Route
                                path="/conges/*"
                                element={
                                    <ProtectedRoute requiredModule="conges">
                                        <CongesApp />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/communication/*"
                                element={
                                    <ProtectedRoute requiredModule="communication">
                                        <CommunicationApp />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </BrowserRouter>
                </AuthProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}

export default App;
