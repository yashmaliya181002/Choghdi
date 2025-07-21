'use server';

// This service uses a simple public "phonebook" to map a 4-digit code to a PeerJS ID.
// It requires no configuration or external accounts (like Vercel KV).

const PHONEBOOK_URL = 'https://lboy.fly.dev/phonebook';

export const createRoom = async (peerId: string): Promise<string> => {
  try {
    const response = await fetch(`${PHONEBOOK_URL}/${peerId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create room. Service responded with: ${errorText}`);
    }

    const data = await response.json();
    if (!data.code) {
      throw new Error("Failed to create room. The phonebook service did not return a code.");
    }
    
    return data.code;
  } catch (error) {
    console.error('Error creating room:', error);
    if (error instanceof Error) {
        throw new Error(`Could not reach the room service. Please check your internet connection and try again. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while creating the room.");
  }
};

export const getPeerIdFromCode = async (code: string): Promise<string | null> => {
  if (!/^\d{4}$/.test(code)) {
    throw new Error("Invalid code format. Please enter a 4-digit code.");
  }
  
  try {
    const response = await fetch(`${PHONEBOOK_URL}/${code}`, {
      method: 'GET',
    });
    
    if (response.status === 404) {
      return null; // Code not found, which is a valid scenario.
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get room info. Service responded with: ${errorText}`);
    }

    const data = await response.json();
    return data.peerId || null;

  } catch (error) {
    console.error('Error getting peer ID from code:', error);
    if (error instanceof Error) {
        throw new Error(`Could not reach the room service. Please check your internet connection and try again. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while retrieving the room information.");
  }
};
