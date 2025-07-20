'use server';

import { kv } from '@vercel/kv';

const CODE_TTL_SECONDS = 3600; // 1 hour

// Simple in-memory fallback for local development if Vercel KV is not configured
const memoryStore = new Map<string, string>();

const useVercelKV = () => {
    return process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
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
            isUnique = !memoryStore.has(`code:${code}`);
        }
        attempts++;
    } while (!isUnique && attempts < 50); // Try 50 times before giving up

    if (!isUnique) {
        throw new Error("Could not generate a unique room code.");
    }

    return code;
};

export const createRoom = async (peerId: string): Promise<{ code: string }> => {
    try {
        const code = await generateUniqueCode();
        
        if (useVercelKV()) {
            await kv.set(`code:${code}`, peerId, { ex: CODE_TTL_SECONDS });
            await kv.set(`peer:${peerId}`, code, { ex: CODE_TTL_SECONDS });
        } else {
            memoryStore.set(`code:${code}`, peerId);
            memoryStore.set(`peer:${peerId}`, code);
        }

        return { code };
    } catch (error) {
        console.error('Error creating room:', error);
        throw new Error('Could not connect to the room service. Please try again.');
    }
};

export const getPeerIdFromCode = async (code: string): Promise<{ peerId: string | null }> => {
    try {
        let peerId: string | null;
        if (useVercelKV()) {
            peerId = await kv.get(`code:${code}`);
        } else {
            peerId = memoryStore.get(`code:${code}`) || null;
        }
        return { peerId };
    } catch (error) {
        console.error('Error retrieving peer ID from code:', error);
        throw new Error('Could not connect to the room service. Please try again.');
    }
};