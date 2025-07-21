
'use server';

import { headers } from 'next/headers';

// This service communicates with our own application's API routes.

const getBaseUrl = () => {
    const headersList = headers();
    const host = headersList.get('host');
    
    // For Vercel deployments, the host is directly available.
    // For local development, it might be localhost with a port.
    if (host) {
        const protocol = host.startsWith('localhost') ? 'http' : 'https';
        return `${protocol}://${host}`;
    }

    // A fallback for environments where the host header might not be available,
    // though this is unlikely in a Next.js environment.
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }

    return 'http://localhost:9002'; 
};


export const createRoom = async (peerId: string): Promise<string> => {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ peerId }),
      // Vercel can cache serverless function responses. 'no-store' ensures we always get a fresh result.
      cache: 'no-store',
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
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/room?code=${code}`, {
        cache: 'no-store',
    });
    
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
