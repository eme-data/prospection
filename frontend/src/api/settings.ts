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

export interface ApiKeysConfig {
    gemini_api_key?: string;
    groq_api_key?: string;
    linkedin_client_id?: string;
    linkedin_client_secret?: string;
    facebook_client_id?: string;
    facebook_client_secret?: string;
    instagram_client_id?: string;
    instagram_client_secret?: string;
}

export const getApiKeysSettings = async (): Promise<ApiKeysConfig> => {
    return await fetchJSON('/api/settings/apikeys');
};

export const updateApiKeysSettings = async (payload: ApiKeysConfig): Promise<void> => {
    await fetchJSON('/api/settings/apikeys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
};
