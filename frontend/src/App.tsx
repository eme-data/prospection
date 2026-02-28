import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './auth/msalConfig';
import { LoginPage } from './components/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';

// Lazy-loaded route modules — chaque app est chargée à la demande
const PortalPage = lazy(() => import('./components/PortalPage').then(m => ({ default: m.PortalPage })));
const FaisabiliteApp = lazy(() => import('./components/FaisabiliteApp').then(m => ({ default: m.FaisabiliteApp })));
const AdminUsersPage = lazy(() => import('./components/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminSettings = lazy(() => import('./components/AdminSettings').then(m => ({ default: m.AdminSettings })));
const CongesApp = lazy(() => import('./apps/Conges/CongesApp').then(m => ({ default: m.CongesApp })));
const CommunicationApp = lazy(() => import('./apps/Communication/CommunicationApp').then(m => ({ default: m.CommunicationApp })));
const CommerceApp = lazy(() => import('./apps/Commerce/CommerceApp').then(m => ({ default: m.CommerceApp })));
const AutobotApp = lazy(() => import('./apps/Autobot/AutobotApp').then(m => ({ default: m.AutobotApp })));
const SecondaryBrainApp = lazy(() => import('./apps/SecondaryBrain/SecondaryBrainApp').then(m => ({ default: m.SecondaryBrainApp })));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 5 * 60 * 1000, retry: 1 },
    },
});
const msalInstance = new PublicClientApplication(msalConfig);

const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
);

// Composant pour protéger les routes
const ProtectedRoute: React.FC<{ children: React.ReactNode, requiredModule?: 'faisabilite' | 'commerce' | 'sav' | 'conges' | 'communication' | 'autobot' | 'secondaryBrain' }> = ({ children, requiredModule }) => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredModule && user) {
        const moduleAccess = user.modules?.[requiredModule];
        if (moduleAccess === false) {
            return <Navigate to="/" replace />;
        }
        if (moduleAccess === undefined) {
            if (requiredModule !== 'faisabilite' && requiredModule !== 'secondaryBrain') {
                return <Navigate to="/" replace />;
            }
        }
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
                            <ToastContainer />
                            <Suspense fallback={<LoadingFallback />}>
                                <Routes>
                                    {/* Route publique */}
                                    <Route path="/login" element={<LoginPage />} />

                                    {/* Routes protégées */}
                                    <Route
                                        path="/"
                                        element={
                                            <ProtectedRoute>
                                                <ErrorBoundary module="Portail">
                                                    <PortalPage />
                                                </ErrorBoundary>
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/faisabilite"
                                        element={
                                            <ProtectedRoute>
                                                <ErrorBoundary module="Faisabilité">
                                                    <FaisabiliteApp />
                                                </ErrorBoundary>
                                            </ProtectedRoute>
                                        }
                                    />

                                    <Route
                                        path="/admin/users"
                                        element={
                                            <AdminRoute>
                                                <ErrorBoundary module="Administration">
                                                    <AdminUsersPage />
                                                </ErrorBoundary>
                                            </AdminRoute>
                                        }
                                    />
                                    <Route
                                        path="/admin/settings"
                                        element={
                                            <AdminRoute>
                                                <ErrorBoundary module="Paramètres">
                                                    <AdminSettings />
                                                </ErrorBoundary>
                                            </AdminRoute>
                                        }
                                    />

                                    <Route
                                        path="/conges/*"
                                        element={
                                            <ProtectedRoute requiredModule="conges">
                                                <ErrorBoundary module="Congés">
                                                    <CongesApp />
                                                </ErrorBoundary>
                                            </ProtectedRoute>
                                        }
                                    />

                                    <Route
                                        path="/communication/*"
                                        element={
                                            <ProtectedRoute requiredModule="communication">
                                                <ErrorBoundary module="Communication">
                                                    <CommunicationApp />
                                                </ErrorBoundary>
                                            </ProtectedRoute>
                                        }
                                    />

                                    <Route
                                        path="/commerce/*"
                                        element={
                                            <ProtectedRoute requiredModule="commerce">
                                                <ErrorBoundary module="Commerce">
                                                    <CommerceApp />
                                                </ErrorBoundary>
                                            </ProtectedRoute>
                                        }
                                    />

                                    <Route
                                        path="/autobot/*"
                                        element={
                                            <ProtectedRoute requiredModule="autobot">
                                                <ErrorBoundary module="Autobot">
                                                    <AutobotApp />
                                                </ErrorBoundary>
                                            </ProtectedRoute>
                                        }
                                    />

                                    <Route
                                        path="/secondary-brain/*"
                                        element={
                                            <ProtectedRoute requiredModule="secondaryBrain">
                                                <ErrorBoundary module="Second Cerveau">
                                                    <SecondaryBrainApp />
                                                </ErrorBoundary>
                                            </ProtectedRoute>
                                        }
                                    />

                                    {/* Fallback */}
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Suspense>
                        </BrowserRouter>
                    </AuthProvider>
                </MsalProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}

export default App;
