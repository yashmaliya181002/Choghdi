// In-memory store for room codes.
// NOTE: This is a simple in-memory store. It will reset if the server instance restarts.
// For a production app that needs persistence, a database (like Vercel KV or Redis) would be better.
const rooms = new Map<string, { peerId: string, createdAt: number }>();
const EXPIRATION_TIME_MS = 2 * 60 * 60 * 1000; // 2 hours

function cleanupExpiredRooms() {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
        if (now - room.createdAt > EXPIRATION_TIME_MS) {
            rooms.delete(code);
        }
    }
}

function generateRoomCode(): string {
    // Generate a 4-digit code that is not currently in use.
    let code: string;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

// POST /api/room - Creates a new room
export async function POST(request: Request) {
    try {
        const { peerId } = await request.json();
        if (!peerId) {
            return new Response(JSON.stringify({ error: 'peerId is required' }), { status: 400 });
        }

        cleanupExpiredRooms();

        const code = generateRoomCode();
        rooms.set(code, { peerId, createdAt: Date.now() });

        return new Response(JSON.stringify({ code }), { status: 201 });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}

// GET /api/room?code=<code> - Gets the peerId for a room
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return new Response(JSON.stringify({ error: 'code query parameter is required' }), { status: 400 });
        }
        
        cleanupExpiredRooms();

        const room = rooms.get(code);

        if (!room) {
            return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });
        }

        return new Response(JSON.stringify({ peerId: room.peerId }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
