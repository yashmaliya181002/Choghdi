'use server';

import { createDeck, dealCards, type GameState, type Player } from './game';

// This file simulates a "game server" or backend service.
// We now use a simple in-memory object to act as our database.
// This will be shared across serverless function invocations on Vercel.

interface Db {
    games: Record<string, GameState>;
}

// In-memory store
const db: Db = {
    games: {}
};

function generateGameId(): string {
    let id = '';
    do {
        id = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (db.games[id]); // Ensure ID is unique in our in-memory store
    return id;
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
    
    db.games[gameId] = initialGameState;
    
    return initialGameState;
};

export const joinGame = async (gameId: string, playerName: string): Promise<{updatedState: GameState, newPlayerId: number}> => {
    const game = db.games[gameId.toUpperCase()];

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
    
    // If the lobby is now full, deal the cards and set phase to bidding
    if (updatedPlayers.length === game.playerCount) {
        const dealtPlayers = dealCards(game.deck, updatedPlayers);
        updatedState = { ...updatedState, players: dealtPlayers, phase: 'bidding' };
    }

    db.games[gameId.toUpperCase()] = updatedState;
    
    return { updatedState, newPlayerId };
};

export const getGameState = async (gameId: string): Promise<GameState | null> => {
    return db.games[gameId.toUpperCase()] || null;
}

export const updateGameState = async (newState: GameState): Promise<GameState> => {
    if (!db.games[newState.id]) {
        throw new Error("Game not found to update.");
    }
    db.games[newState.id] = newState;

    return newState;
}
