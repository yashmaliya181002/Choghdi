
const getBaseUrl = () => {
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    }
    // Assume localhost for local development
    return 'http://localhost:9002';
};

export async function createRoom(hostPeerId: string): Promise<{ roomCode: string }> {
  const res = await fetch(`${getBaseUrl()}/api/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostPeerId }),
  });
  if (!res.ok) {
    throw new Error('Failed to create room on server');
  }
  return res.json();
}

export async function getRoomHost(roomCode: string): Promise<{ hostPeerId: string }> {
  const res = await fetch(`${getBaseUrl()}/api/room?roomCode=${roomCode}`);
  if (!res.ok) {
    if (res.status === 404) {
        throw new Error('Room code not found.');
    }
    throw new Error('Failed to look up room on server');
  }
  return res.json();
}
