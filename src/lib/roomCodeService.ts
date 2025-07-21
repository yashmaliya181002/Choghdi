
const getBaseUrl = () => {
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
        return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    }
    // Fallback for local development
    return 'http://localhost:3000';
};

export async function createRoom(hostPeerId: string): Promise<{ roomCode: string }> {
  const res = await fetch(`/api/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostPeerId }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Failed to create room on server' }));
    throw new Error(errorBody.error);
  }
  return res.json();
}

export async function getRoomHost(roomCode: string): Promise<{ hostPeerId: string }> {
  const res = await fetch(`/api/room?roomCode=${roomCode}`);
  if (!res.ok) {
    if (res.status === 404) {
        throw new Error('Room code not found.');
    }
    const errorBody = await res.json().catch(() => ({ error: 'Failed to look up room on server' }));
    throw new Error(errorBody.error);
  }
  return res.json();
}
