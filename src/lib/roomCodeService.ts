
'use server';

import { promises as fs } from 'fs';
import path from 'path';

// Vercel provides a temporary directory for file storage.
const ROOMS_FILE_PATH = path.join('/tmp', 'rooms.json');

type Room = {
    code: string;
    peerId: string;
    createdAt: number;
};

async function readRooms(): Promise<Room[]> {
    try {
        await fs.access(ROOMS_FILE_PATH);
        const fileContent = await fs.readFile(ROOMS_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        // If file does not exist or is invalid, return empty array.
        return [];
    }
}

async function writeRooms(rooms: Room[]): Promise<void> {
    await fs.writeFile(ROOMS_FILE_PATH, JSON.stringify(rooms, null, 2), 'utf-8');
}

function generateRoomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Creates a new room, generates a 4-digit code, and maps it to the host's peerId.
 * @param peerId The host's unique PeerJS ID.
 * @returns The generated 4-digit room code.
 */
export async function createRoomCode(peerId: string): Promise<string> {
    let rooms = await readRooms();
    
    // Clean up old rooms (older than 2 hours) to prevent the file from growing indefinitely.
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    rooms = rooms.filter(room => room.createdAt > twoHoursAgo);

    let newCode: string;
    let isUnique = false;

    // Ensure the generated code is unique
    do {
        newCode = generateRoomCode();
        if (!rooms.some(room => room.code === newCode)) {
            isUnique = true;
        }
    } while (!isUnique);

    const newRoom: Room = {
        code: newCode,
        peerId: peerId,
        createdAt: Date.now(),
    };

    rooms.push(newRoom);
    await writeRooms(rooms);

    return newCode;
}

/**
 * Retrieves the host's peerId associated with a given 4-digit room code.
 * @param code The 4-digit room code entered by the joining player.
 * @returns The host's PeerJS ID, or null if the code is not found or expired.
 */
export async function getRoomPeerId(code: string): Promise<string | null> {
    const rooms = await readRooms();
    const room = rooms.find(r => r.code === code);
    
    // Optional: Check for expiry.
    if (room && (Date.now() - room.createdAt) < (2 * 60 * 60 * 1000)) {
        return room.peerId;
    }
    
    return null;
}
