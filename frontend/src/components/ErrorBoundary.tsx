import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    /** Nom du module affiché dans le message d'erreur (ex: "Faisabilité") */
    module?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[ErrorBoundary${this.props.module ? ` — ${this.props.module}` : ''}]`, error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        const moduleName = this.props.module ?? 'ce module';

        return (
            <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-white mb-1">
                        Une erreur est survenue dans {moduleName}
                    </h2>
                    <p className="text-sm text-gray-400 max-w-sm">
                        {this.state.error?.message ?? 'Erreur inattendue. Réessayez ou rechargez la page.'}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Réessayer
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                    >
                        Recharger la page
                    </button>
                </div>
            </div>
        );
    }
}
