'use server';

import { createDeck, dealCards, type GameState, type Player } from './game';

// This file simulates a "game server" or backend service.
// It uses a simple in-memory Map to store game states. On a serverless
// platform like Vercel, this map is NOT guaranteed to persist between
// function calls, but for simple, short-lived games, it can work.
// A more robust solution would use a proper database like Redis, Firebase, or Postgres.

// A shared, in-memory store for all game states.
// IMPORTANT: This is the critical part for making it work on Vercel.
// We declare it once at the top level.
const gameStore = new Map<string, GameState>();

function generateGameId(): string {
    let id = '';
    // Omitted O, 0, I, L, 1 to reduce confusion
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; 
    do {
        id = '';
        for (let i = 0; i < 4; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (gameStore.has(id)); // Ensure the ID is unique
    return id;
}

export const createNewGame = async (playerCount: number, hostPlayerName: string): Promise<GameState> => {
    const gameId = generateGameId();
    const deck = createDeck(playerCount);

    const hostPlayer: Player = {
        id: 0, // Host is always player 0
        name: hostPlayerName,
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
        players: [hostPlayer],
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
        turnHistory: [`Game created by ${hostPlayerName}`],
    };

    gameStore.set(gameId, initialGameState);
    console.log(`Game created: ${gameId}`, gameStore.get(gameId));
    
    return initialGameState;
};

export const joinGame = async (gameId: string, playerName: string): Promise<{updatedState: GameState, newPlayerId: number}> => {
    const gameState = gameStore.get(gameId);
    console.log(`Attempting to join game: ${gameId}. Found:`, gameState);

    if (!gameState) {
        throw new Error("Game not found. Please check the code.");
    }

    if (gameState.phase !== 'lobby') {
        throw new Error("This game has already started.");
    }
    
    if (gameState.players.length >= gameState.playerCount) {
        throw new Error("This game is full.");
    }
    
    const newPlayerId = gameState.players.length;
    const newPlayer: Player = {
        id: newPlayerId,
        name: playerName,
        hand: [],
        isBidder: false,
        isPartner: false,
        collectedCards: [],
        tricksWon: 0,
    };

    gameState.players.push(newPlayer);
    gameState.turnHistory.push(`${playerName} joined the game.`);

    // If the last player joined, deal the cards
    if (gameState.players.length === gameState.playerCount) {
        const dealtPlayers = dealCards(gameState.deck, gameState.players);
        gameState.players = dealtPlayers;
        // The host will press start, so we don't change the phase here anymore.
        // gameState.phase = 'bidding';
        gameState.turnHistory.push(`All players have joined. The host can now start the game.`);
    }

    gameStore.set(gameId, gameState);
    console.log(`Game state updated after join: ${gameId}`, gameStore.get(gameId));


    return { updatedState: gameState, newPlayerId };
};

export const getGameState = async (gameId: string): Promise<GameState | null> => {
     const state = gameStore.get(gameId) || null;
     console.log(`Getting state for ${gameId}. Found:`, state);
     return state;
}

export const updateGameState = async (newState: GameState): Promise<GameState> => {
    if (!gameStore.has(newState.id)) {
        throw new Error("Game not found to update.");
    }
    gameStore.set(newState.id, newState);
    console.log(`Game state updated: ${newState.id}`, gameStore.get(newState.id));
    return newState;
}