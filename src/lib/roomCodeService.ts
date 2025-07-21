'use server';

// This service uses a simple public "phonebook" to map a 4-digit code to a PeerJS ID.
// This is a more reliable implementation for demonstration purposes.
// Data is stored in memory on the service and may reset, but the service itself is stable.

const PHONEBOOK_URL = 'https://peer-server-simple-phonebook.glitch.me';

export const createRoom = async (peerId: string): Promise<string> => {
  try {
    // The service expects the peerId in the body for creation
    const response = await fetch(`${PHONEBOOK_URL}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ peerId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Service responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.code) {
      throw new Error("The room service did not return a valid code.");
    }
    
    return data.code;
  } catch (error) {
    console.error('Error creating room:', error);
    if (error instanceof Error) {
        throw new Error(`Could not create the room. Please check your internet connection and try again. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while creating the room.");
  }
};

export const getPeerIdFromCode = async (code: string): Promise<string | null> => {
  if (!/^\d{4}$/.test(code)) {
    throw new Error("Invalid code format. Please enter a 4-digit code.");
  }
  
  try {
    const response = await fetch(`${PHONEBOOK_URL}/get/${code}`, {
      method: 'GET',
    });
    
    if (response.status === 404) {
      return null; // Code not found, which is a valid scenario.
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Service responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.peerId || null;

  } catch (error) {
    console.error('Error getting peer ID from code:', error);
    if (error instanceof Error) {
        throw new Error(`Could not join the room. Please check the code and your internet connection. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while retrieving the room information.");
  }
};
