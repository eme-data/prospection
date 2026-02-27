export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration: number;
}

type Listener = (toasts: ToastMessage[]) => void;

class ToastManager {
    private toasts: ToastMessage[] = [];
    private listeners: Set<Listener> = new Set();

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l([...this.toasts]));
    }

    add(type: ToastType, message: string, duration = 4500): string {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.toasts = [...this.toasts, { id, type, message, duration }];
        this.notify();
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }
        return id;
    }

    remove(id: string) {
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.notify();
    }

    success(message: string, duration?: number) { return this.add('success', message, duration); }
    error(message: string, duration?: number)   { return this.add('error',   message, duration ?? 6000); }
    info(message: string, duration?: number)    { return this.add('info',    message, duration); }
    warning(message: string, duration?: number) { return this.add('warning', message, duration); }
}

export const toast = new ToastManager();
