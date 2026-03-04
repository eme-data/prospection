import { fetchJSON } from './index';

export interface SentimentItem {
    id: number;
    source: string;
    title: string | null;
    content: string;
    url: string | null;
    author: string | null;
    published_at: string | null;
    sentiment_score: number;
    sentiment_label: string;
}

export interface SentimentAnalysis {
    id: number;
    query: string;
    sources: string;
    sentiment_score: number;
    sentiment_label: string;
    total_items: number;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    summary: string | null;
    created_at: string;
}

export interface SentimentAnalysisDetail extends SentimentAnalysis {
    items: SentimentItem[];
}

export const analyzeSentiment = (query: string, sources: string[]): Promise<SentimentAnalysisDetail> =>
    fetchJSON('/api/sentiment/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sources }),
    });

export const analyzeManualTexts = (texts: string[], query?: string): Promise<SentimentAnalysisDetail> =>
    fetchJSON('/api/sentiment/analyze/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, query: query || 'Analyse manuelle' }),
    });

export const getAnalyses = (limit: number = 20, offset: number = 0): Promise<SentimentAnalysis[]> =>
    fetchJSON(`/api/sentiment/analyses?limit=${limit}&offset=${offset}`);

export const getAnalysisDetail = (id: number): Promise<SentimentAnalysisDetail> =>
    fetchJSON(`/api/sentiment/analyses/${id}`);

export const deleteAnalysis = (id: number): Promise<{ success: boolean; message: string }> =>
    fetchJSON(`/api/sentiment/analyses/${id}`, { method: 'DELETE' });
