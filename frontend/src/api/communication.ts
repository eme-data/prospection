import { fetchJSON } from './index';

export interface GeneratePostParams {
    topic: string;
    platform: string;
    ai_model: string;
    tone?: string;
    length?: string;
    include_hashtags?: boolean;
    include_emojis?: boolean;
}

export interface Post {
    id: number;
    platform: string;
    ai_model: string;
    topic: string;
    content: string;
    tone: string;
    length: string;
    include_hashtags: boolean;
    include_emojis: boolean;
    published_to_linkedin: boolean;
    published_to_facebook: boolean;
    published_to_instagram: boolean;
    created_at: string;
}

export interface SocialAccount {
    id: number;
    platform: string;
    expiresAt: string | null;
    isValid: boolean;
}

export const generatePost = async (params: GeneratePostParams): Promise<{ success: boolean; post: Post }> => {
    return await fetchJSON('/api/communication/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });
};

export const getHistory = async (limit: number = 20, offset: number = 0): Promise<{ success: boolean; posts: Post[]; pagination: any }> => {
    return await fetchJSON(`/api/communication/history?limit=${limit}&offset=${offset}`);
};

export const deletePost = async (postId: number): Promise<{ success: boolean; message: string }> => {
    return await fetchJSON(`/api/communication/history/${postId}`, {
        method: 'DELETE',
    });
};

export const getSocialAccounts = async (): Promise<{ success: boolean; accounts: SocialAccount[] }> => {
    return await fetchJSON('/api/communication/accounts');
};

export const publishPost = async (platform: string, postId: number): Promise<{ success: boolean; message: string; url?: string }> => {
    return await fetchJSON(`/api/communication/publish/${platform}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ post_id: postId }),
    });
};

// ========== GALERIE LOGOS ==========

export interface SavedLogo {
    id: string;
    company_name: string;
    sector: string | null;
    style: string | null;
    colors: string | null;
    svg_content: string;
    created_at: string;
}

export interface SaveLogoParams {
    company_name: string;
    sector?: string;
    style?: string;
    colors?: string;
    svg_content: string;
}

export const saveLogo = (params: SaveLogoParams): Promise<{ id: string; created_at: string }> =>
    fetchJSON('/api/communication/logos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

export const getLogos = (): Promise<SavedLogo[]> =>
    fetchJSON('/api/communication/logos/');

export const deleteLogo = (id: string): Promise<{ success: boolean }> =>
    fetchJSON(`/api/communication/logos/${id}`, { method: 'DELETE' });
