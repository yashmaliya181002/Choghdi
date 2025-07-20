'use server';

import { createDeck, dealCards, type GameState, type Player } from './game';
import { kv } from '@vercel/kv';

const IS_VERCEL_KV_AVAILABLE = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// Fallback in-memory store for local development
const memoryStore = new Map<string, GameState>();

async function generateGameId(): Promise<string> {
    let id = '';
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; 
    let isUnique = false;
    while (!isUnique) {
        id = '';
        for (let i = 0; i < 4; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existingGame = await getGameState(id);
        if (!existingGame) {
            isUnique = true;
        }
    }
    return id;
}

export const createNewGame = async (playerCount: number, hostPlayerName: string): Promise<GameState> => {
    const gameId = await generateGameId();
    const deck = createDeck(playerCount);

    const hostPlayer: Player = {
        id: 0,
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

    if (IS_VERCEL_KV_AVAILABLE) {
        await kv.set(`game:${gameId}`, JSON.stringify(initialGameState), { ex: 7200 });
    } else {
        console.log("Using in-memory store for local development.");
        memoryStore.set(`game:${gameId}`, initialGameState);
    }
    
    return initialGameState;
};

export const joinGame = async (gameId: string, playerName: string): Promise<{updatedState: GameState, newPlayerId: number}> => {
    const gameState = await getGameState(gameId);

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

    if (gameState.players.length === gameState.playerCount) {
        const dealtPlayers = dealCards(gameState.deck, gameState.players);
        gameState.players = dealtPlayers;
        gameState.turnHistory.push(`All players have joined. The host can now start the game.`);
    }

    await updateGameState(gameState);

    return { updatedState: gameState, newPlayerId };
};

export const getGameState = async (gameId: string): Promise<GameState | null> => {
    if (IS_VERCEL_KV_AVAILABLE) {
        const stateJSON = await kv.get(`game:${gameId}`);
        if (!stateJSON) return null;
        return JSON.parse(stateJSON as string) as GameState;
    } else {
        return memoryStore.get(`game:${gameId}`) || null;
    }
}

export const updateGameState = async (newState: GameState): Promise<GameState> => {
    if (IS_VERCEL_KV_AVAILABLE) {
        await kv.set(`game:${newState.id}`, JSON.stringify(newState), { ex: 7200 });
    } else {
        memoryStore.set(`game:${newState.id}`, newState);
    }
    return newState;
}