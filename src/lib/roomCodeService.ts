'use server';

const ROOM_SERVICE_URL = 'https://lboy.fly.dev/api/room';

/**
 * Creates a new room using a public service, getting a short code for a peerId.
 * @param peerId The host's full PeerJS ID.
 * @returns The new 4-digit room code.
 * @throws If the service is unavailable or fails to create a room.
 */
export const createRoom = async (peerId: string): Promise<string> => {
  try {
    const response = await fetch(ROOM_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ peerId }),
    });

    if (!response.ok) {
      throw new Error(`Room service failed with status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.roomCode) {
        throw new Error('Room service did not return a room code.');
    }

    return data.roomCode;
  } catch (error) {
    console.error('Error creating room:', error);
    throw new Error('Could not connect to the room service. Please try again.');
  }
};

/**
 * Retrieves the host's PeerJS ID for a given 4-digit room code.
 * @param roomCode The 4-digit room code.
 * @returns The host's PeerJS ID, or null if not found.
 */
export const getPeerIdForRoom = async (roomCode: string): Promise<string | null> => {
  try {
    const response = await fetch(`${ROOM_SERVICE_URL}/${roomCode}`);
    if (response.status === 404) {
      return null; // Not found
    }
    if (!response.ok) {
      throw new Error(`Room service failed with status: ${response.status}`);
    }
    const data = await response.json();
    return data.peerId || null;
  } catch (error) {
    console.error('Error getting peer ID:', error);
    throw new Error('Could not connect to the room service. Please try again.');
  }
};
