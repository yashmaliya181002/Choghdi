
// A simple, dependency-free service to map a short room code to a full PeerJS ID.
// This uses a free, public "phonebook" service (lboy.fly.dev).
// While convenient, be aware that public services can have occasional downtime.

const SERVICE_URL = 'https://lboy.fly.dev';

// Creates a new room, returning the short 4-digit code.
export const createRoom = async (peerId: string): Promise<string> => {
  try {
    const response = await fetch(`${SERVICE_URL}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: peerId }),
    });
    if (!response.ok) {
        throw new Error(`Failed to create room, status: ${response.status}`);
    }
    const data = await response.json();
    return data.room; // The 4-digit code
  } catch (error) {
    console.error("Error creating room:", error);
    // As a fallback, we could return the full peerId, but for now we throw
    // to make it clear the service failed.
    throw new Error("Could not connect to the room service.");
  }
};

// Gets the full PeerJS ID for a given 4-digit room code.
export const getRoomPeerId = async (roomCode: string): Promise<string | null> => {
  try {
    // If the input is long, it's likely already a full PeerJS ID.
    if (roomCode.length > 5) {
        return roomCode;
    }

    const response = await fetch(`${SERVICE_URL}/get/${roomCode}`);
    if (response.status === 404) {
        return null; // Room not found
    }
    if (!response.ok) {
        throw new Error(`Failed to get room, status: ${response.status}`);
    }
    const data = await response.json();
    return data.id; // The full PeerJS ID
  } catch (error) {
    console.error("Error getting room peer ID:", error);
    return null;
  }
};
