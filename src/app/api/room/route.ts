
import { NextResponse } from 'next/server';
import { roomStore, activeCodes } from '@/lib/roomStore';

function generateRoomCode(): string {
  let code = '';
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (activeCodes.has(code));
  return code;
}

export async function POST(request: Request) {
  try {
    const { hostPeerId } = await request.json();
    if (!hostPeerId) {
      return NextResponse.json({ error: 'hostPeerId is required' }, { status: 400 });
    }

    const roomCode = generateRoomCode();
    roomStore.set(roomCode, hostPeerId);
    activeCodes.add(roomCode);

    // Clean up the code after a few hours to prevent memory leaks
    setTimeout(() => {
        roomStore.delete(roomCode);
        activeCodes.delete(roomCode);
    }, 1000 * 60 * 60 * 4); // 4 hours

    return NextResponse.json({ roomCode });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const roomCode = searchParams.get('roomCode');
        
        if (!roomCode) {
            return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });
        }
    
        const hostPeerId = roomStore.get(roomCode);
    
        if (!hostPeerId) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }
    
        return NextResponse.json({ hostPeerId });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to find room' }, { status: 500 });
    }
}
