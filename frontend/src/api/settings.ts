import { fetchJSON } from './index';

export interface SmtpConfig {
    host: string;
    port: number;
    user: string;
    password?: string;
}

export const getSmtpSettings = async (): Promise<SmtpConfig> => {
    return await fetchJSON('/api/settings/smtp');
};

export const updateSmtpSettings = async (payload: SmtpConfig): Promise<void> => {
    await fetchJSON('/api/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
};
