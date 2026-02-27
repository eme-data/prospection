import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { toast, ToastMessage } from '../utils/toast';

const ICONS: Record<ToastMessage['type'], React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />,
    error:   <XCircle      className="w-5 h-5 text-red-400   shrink-0" />,
    info:    <Info         className="w-5 h-5 text-blue-400  shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />,
};

const BG: Record<ToastMessage['type'], string> = {
    success: 'bg-green-950/90  border-green-700/60',
    error:   'bg-red-950/90    border-red-700/60',
    info:    'bg-blue-950/90   border-blue-700/60',
    warning: 'bg-yellow-950/90 border-yellow-700/60',
};

function ToastItem({ t, onClose }: { t: ToastMessage; onClose: () => void }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Petite animation d'entrée
        const tid = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(tid);
    }, []);

    return (
        <div
            className={`
                flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl
                backdrop-blur-sm text-sm text-white
                transition-all duration-300
                ${BG[t.type]}
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
            `}
        >
            {ICONS[t.type]}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
                onClick={onClose}
                className="text-white/50 hover:text-white transition-colors mt-0.5"
                aria-label="Fermer"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => toast.subscribe(setToasts), []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem t={t} onClose={() => toast.remove(t.id)} />
                </div>
            ))}
        </div>
    );
}
