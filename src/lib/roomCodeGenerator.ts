// This function generates a random 4-digit numeric code.
// It's simple and doesn't require any external services or dependencies.
export const generateRoomCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};
