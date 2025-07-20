import { createDeck, dealCards, type GameState, type Player } from './game';

// This file simulates a "game server" or backend service.
// In a real application, this logic would live on a server and use a database (like Firestore)
// to store and sync game state across all clients in real-time.

// In-memory store for games, simulating a database.
const games = new Map<string, GameState>();

function generateGameId(): string {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}


export const createNewGame = async (playerCount: number, hostName: string): Promise<GameState> => {
    const gameId = generateGameId();
    const deck = createDeck(playerCount);

    const hostPlayer: Player = {
        id: 0,
        name: hostName,
        hand: [],
        isBidder: false,
        isPartner: false,
        collectedCards: [],
        tricksWon: 0,
    };
    
    const initialGameState: GameState = {
        id: gameId,
        phase: 'lobby',
        playerCount,
        players: [hostPlayer], // Start with only the host
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
    
    games.set(gameId, initialGameState);
    return initialGameState;
};

export const joinGame = async (gameId: string, playerName: string): Promise<{updatedState: GameState, newPlayerId: number}> => {
    const game = games.get(gameId.toUpperCase());
    if (!game) {
        throw new Error('Game not found.');
    }
    if (game.phase !== 'lobby') {
        throw new Error('Game has already started.');
    }
    if (game.players.length >= game.playerCount) {
        throw new Error('Game is full.');
    }

    const newPlayerId = game.players.length;
    const newPlayer: Player = {
        id: newPlayerId,
        name: playerName,
        hand: [],
        isBidder: false,
        isPartner: false,
        collectedCards: [],
        tricksWon: 0,
    };

    const updatedPlayers = [...game.players, newPlayer];
    let updatedState = { ...game, players: updatedPlayers };
    
    // If the lobby is now full, deal the cards
    if (updatedPlayers.length === game.playerCount) {
        const dealtPlayers = dealCards(game.deck, updatedPlayers);
        updatedState = { ...updatedState, players: dealtPlayers };
    }

    games.set(gameId.toUpperCase(), updatedState);
    
    return { updatedState, newPlayerId };
};

export const getGameState = async (gameId: string): Promise<GameState | null> => {
    return games.get(gameId.toUpperCase()) || null;
}

export const updateGameState = async (newState: GameState): Promise<GameState> => {
    if (!games.has(newState.id)) {
        throw new Error("Game not found to update.");
    }
    games.set(newState.id, newState);
    return newState;
}

// Placeholder for creating the initial game state for local testing, can be removed later
export const createInitialGameState = (playerCount: number, initialPlayers: {id: number, name: string}[]): GameState => {
    const gameId = generateGameId();
    const deck = createDeck(playerCount);

    const players: Player[] = Array.from({ length: playerCount }, (_, i) => {
        const initialPlayer = initialPlayers.find(p => p.id === i);
        return {
            id: i,
            name: initialPlayer ? initialPlayer.name : `Player ${i + 1}`,
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
    
    games.set(gameId, gameState);

    return gameState;
};
