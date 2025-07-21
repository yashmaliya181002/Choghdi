'use server';

import { kv } from '@vercel/kv';

const CODE_TTL_SECONDS = 3600; // 1 hour
const MAX_ATTEMPTS = 50;

// Simple in-memory fallback for local development if Vercel KV is not configured
const memoryStore = new Map<string, string>();

const useVercelKV = () => {
  return !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
};

const generateUniqueCode = async (): Promise<string> => {
    let code: string;
    let isUnique = false;
    let attempts = 0;

    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        if (useVercelKV()) {
            isUnique = !(await kv.exists(`code:${code}`));
        } else {
            console.log("Using in-memory store for room codes.");
            isUnique = !memoryStore.has(`code:${code}`);
        }
        attempts++;
    } while (!isUnique && attempts < MAX_ATTEMPTS);

    if (!isUnique) {
        throw new Error("Could not generate a unique room code. The service might be busy.");
    }

    return code;
};


export const createRoom = async (peerId: string): Promise<{ code: string }> => {
    try {
        const code = await generateUniqueCode();
        
        if (useVercelKV()) {
            await kv.set(`code:${code}`, peerId, { ex: CODE_TTL_SECONDS });
        } else {
            memoryStore.set(`code:${code}`, peerId);
            // Simulate TTL for memory store
            setTimeout(() => memoryStore.delete(`code:${code}`), CODE_TTL_SECONDS * 1000);
        }

        return { code };
    } catch (error: any) {
        console.error('Error creating room:', error);
        throw new Error(`Failed to create room: ${error.message}`);
    }
};

export const getPeerIdFromCode = async (code: string): Promise<{ peerId: string | null }> => {
    if (!/^\d{4}$/.test(code)) {
        return { peerId: null };
    }
    
    try {
        let peerId: string | null;
        if (useVercelKV()) {
            peerId = await kv.get(`code:${code}`);
        } else {
            peerId = memoryStore.get(`code:${code}`) || null;
        }
        return { peerId };
    } catch (error: any) {
        console.error('Error retrieving peer ID from code:', error);
        throw new Error(`Failed to retrieve room: ${error.message}`);
    }
};
