'use server';

import { kv } from '@vercel/kv';

// This service maps short, user-friendly 4-digit codes to long, technical PeerJS IDs.
// It uses Vercel KV to store the mappings, making it reliable in a serverless environment.

// Function to generate a random 4-digit numeric code as a string.
const generateRoomCode = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Creates a new room, generating a unique 4-digit code and mapping it to the host's peerId.
 * It will retry a few times if it generates a code that's already in use.
 * @param peerId The host's full PeerJS ID.
 * @returns The new 4-digit room code.
 * @throws If a unique room code cannot be generated after several attempts.
 */
export const createRoom = async (peerId: string): Promise<string> => {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log("KV store not configured. Cannot create room.");
        throw new Error("Server configuration error. Cannot create room.");
    }

    let roomCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        roomCode = generateRoomCode();
        // Use `setnx` to set the value only if the key does not already exist.
        // It returns 1 if the key was set, or 0 if the key already existed.
        const wasSet = await kv.setnx(`room:${roomCode}`, peerId);
        if (wasSet) {
            // Set an expiration for the room code to clean up old games.
            // 2 hours in seconds.
            await kv.expire(`room:${roomCode}`, 2 * 60 * 60); 
            return roomCode;
        }
        attempts++;
    }

    throw new Error('Could not create a new room. Please try again.');
};

/**
 * Retrieves the host's PeerJS ID associated with a given 4-digit room code.
 * @param roomCode The 4-digit room code entered by the joining player.
 * @returns The host's PeerJS ID, or null if the room code is not found.
 */
export const getPeerIdForRoom = async (roomCode: string): Promise<string | null> => {
     if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log("KV store not configured. Cannot get peer ID.");
        return null; // In local dev without KV, we can't join rooms this way.
    }
    return await kv.get(`room:${roomCode}`);
};
