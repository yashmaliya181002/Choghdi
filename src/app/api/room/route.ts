
import { NextRequest, NextResponse } from 'next/server';
import { createRoomCode, getRoomPeerId } from '@/lib/roomCodeService';

/**
 * GET /api/room?code=1234
 * Looks up a room code and returns the host's PeerJS ID.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    try {
        const peerId = await getRoomPeerId(code);
        if (peerId) {
            return NextResponse.json({ peerId });
        } else {
            return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
        }
    } catch (error) {
        console.error('Error getting room peer ID:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


/**
 * POST /api/room
 * Creates a new room and returns a 4-digit code.
 * Body: { "peerId": "your-peer-id" }
 */
export async function POST(request: NextRequest) {
    try {
        const { peerId } = await request.json();
        if (!peerId) {
            return NextResponse.json({ error: 'Peer ID is required' }, { status: 400 });
        }
        
        const code = await createRoomCode(peerId);
        
        return NextResponse.json({ code }, { status: 201 });
    } catch (error) {
        console.error('Error creating room code:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

