import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { PortalPage } from './components/PortalPage';
import { FaisabiliteApp } from './components/FaisabiliteApp';

const queryClient = new QueryClient();

// Composant pour protéger les routes
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
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
