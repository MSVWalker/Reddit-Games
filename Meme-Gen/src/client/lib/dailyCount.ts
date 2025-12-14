import type { DailyCountResponse } from '../../shared/types/api';

const VISIT_KEY = 'meme-gen-daily-visit';
const COUNT_KEY = 'meme-gen-daily-count';

const today = () => new Date().toISOString().slice(0, 10); // UTC date

const safeLocalStorage = () => {
    try {
        if (typeof localStorage !== 'undefined') return localStorage;
    } catch (_) {
        // ignore
    }
    return null;
};

const fetchCount = async (path: string, method: 'GET' | 'POST'): Promise<number> => {
    const res = await fetch(path, { method });
    if (!res.ok) throw new Error(`Failed to fetch daily count: ${res.status}`);
    const data = (await res.json()) as DailyCountResponse;
    if (typeof data?.count !== 'number') throw new Error('Invalid daily count response');
    return data.count;
};

export const getDailyCount = async (): Promise<number> => {
    const ls = safeLocalStorage();
    const day = today();
    try {
        const count = await fetchCount('/api/daily-count', 'GET');
        if (ls) {
            ls.setItem(VISIT_KEY, day);
            ls.setItem(COUNT_KEY, count.toString());
        }
        return count;
    } catch (error) {
        if (ls) {
            const cachedDay = ls.getItem(VISIT_KEY);
            const cachedCount = ls.getItem(COUNT_KEY);
            if (cachedDay === day && cachedCount) {
                const parsed = parseInt(cachedCount, 10);
                if (!Number.isNaN(parsed)) return parsed;
            }
        }
        throw error;
    }
};

export const incrementDailyCountOnce = async (): Promise<number> => {
    const ls = safeLocalStorage();
    const day = today();

    // If we've already counted this client today, just fetch the current count
    if (ls?.getItem(VISIT_KEY) === day) {
        return getDailyCount();
    }

    try {
        const count = await fetchCount('/api/daily-visit', 'POST');
        if (ls) {
            ls.setItem(VISIT_KEY, day);
            ls.setItem(COUNT_KEY, count.toString());
        }
        return count;
    } catch (error) {
        // Fallback to a read-only fetch if increment fails
        try {
            return await getDailyCount();
        } catch {
            return 0;
        }
    }
};
