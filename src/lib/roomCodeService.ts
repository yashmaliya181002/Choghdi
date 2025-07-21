'use server';

// This service communicates with our own application's API routes.

const getBaseUrl = () => {
    if (process.env.VERCEL_URL) {
        // Vercel-provided URL for production/preview deployments.
        return `https://${process.env.VERCEL_URL}`;
    }
    // Fallback for local development. Assumes the app is running on port 9002.
    // This is necessary because server-side fetch needs an absolute URL.
    return 'http://localhost:9002'; 
};


export const createRoom = async (peerId: string): Promise<string> => {
  try {
    const response = await fetch(`${getBaseUrl()}/api/room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ peerId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.code) {
      throw new Error("The server did not return a valid room code.");
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
    const response = await fetch(`${getBaseUrl()}/api/room?code=${code}`);
    
    if (response.status === 404) {
      return null; // Code not found, which is a valid scenario.
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.peerId || null;

  } catch (error) {
    console.error('Error getting peer ID from code:', error);
    if (error instanceof Error) {
        throw new Error(`Could not join the room. Please check the code and your internet connection. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while retrieving room information.");
  }
};
