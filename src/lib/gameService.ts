import { createDeck, dealCards, type GameState, type Player } from './game';

// This file simulates a "game server" or backend service.
// In a real application, this logic would live on a server and use a database (like Firestore)
// to store and sync game state across all clients in real-time.

// In-memory store for games, simulating a database.
const games = new Map<string, GameState>();

function generateGameId(): string {
    return Math.random().toString(36).substr(2, 5).toUpperCase();
}


export const createInitialGameState = (playerCount: number, initialPlayers: {id: number, name: string}[]): GameState => {
    const gameId = generateGameId();
    const deck = createDeck(playerCount);

    const players: Player[] = Array.from({ length: playerCount }, (_, i) => {
        const initialPlayer = initialPlayers.find(p => p.id === i);
        return {
            id: i,
            name: initialPlayer ? initialPlayer.name : `Waiting...`,
            hand: [],
            isBidder: false,
            isPartner: false,
            collectedCards: [],
            tricksWon: 0,
        };
    });

    const dealtPlayers = dealCards(deck, players);

    const gameState: GameState = {
        id: gameId,
        phase: 'bidding',
        playerCount,
        players: dealtPlayers,
        deck,
        bids: [],
        highestBid: null,
        trumpSuit: null,
        partnerCards: [],
        currentPlayerId: 0,
        currentTrick: { cards: [], leadingSuit: null },
        tricksPlayed: 0,
        team1Score: 0,
        team2Score: 0,
    };
    
    // Simulate saving to a database
    games.set(gameId, gameState);

    return gameState;
};
