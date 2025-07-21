
// By placing the store in its own module, we can leverage Node.js's module caching.
// This means there will be a single instance of roomStore and activeCodes
// across all requests handled by a single server process.
// In a serverless environment, this helps maintain state between "warm" function invocations.

export const roomStore = new Map<string, string>(); // Map<roomCode, hostPeerId>
export const activeCodes = new Set<string>();
