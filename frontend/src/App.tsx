import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './auth/msalConfig';
import { LoginPage } from './components/LoginPage';
import { PortalPage } from './components/PortalPage';
import { FaisabiliteApp } from './components/FaisabiliteApp';
import { AdminUsersPage } from './components/AdminUsersPage';
import { AdminSettings } from './components/AdminSettings';
import { CongesApp } from './apps/Conges/CongesApp';
import { CommunicationApp } from './apps/Communication/CommunicationApp';
import { CommerceApp } from './apps/Commerce/CommerceApp';
import { AutobotApp } from './apps/Autobot/AutobotApp';

import { SecondaryBrainApp } from './apps/SecondaryBrain/SecondaryBrainApp';

const queryClient = new QueryClient();
const msalInstance = new PublicClientApplication(msalConfig);

// Composant pour protéger les routes
const ProtectedRoute: React.FC<{ children: React.ReactNode, requiredModule?: 'faisabilite' | 'commerce' | 'sav' | 'conges' | 'communication' | 'autobot' | 'secondaryBrain' }> = ({ children, requiredModule }) => {
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
                <MsalProvider instance={msalInstance}>
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

                                <Route
                                    path="/commerce/*"
                                    element={
                                        <ProtectedRoute requiredModule="commerce">
                                            <CommerceApp />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route
                                    path="/autobot/*"
                                    element={
                                        <ProtectedRoute requiredModule="autobot">
                                            <AutobotApp />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route
                                    path="/secondary-brain/*"
                                    element={
                                        <ProtectedRoute requiredModule="secondaryBrain">
                                            <SecondaryBrainApp />
                                        </ProtectedRoute>
                                    }
                                />

                                {/* Fallback */}
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </BrowserRouter>
                    </AuthProvider>
                </MsalProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}

export default App;
