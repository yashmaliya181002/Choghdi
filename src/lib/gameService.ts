'use server';

import { createDeck, dealCards, type GameState, type Player } from './game';
import fs from 'fs';
import path from 'path';

// This file simulates a "game server" or backend service.
// It now uses a simple db.json file to persist state across browser tabs for local testing.
const dbPath = path.join(process.cwd(), 'db.json');

interface Db {
    games: Record<string, GameState>;
}

function readDb(): Db {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf-8');
            return JSON.parse(data) as Db;
        }
    } catch (error) {
        console.error("Error reading db.json:", error);
    }
    // If file doesn't exist or is invalid, return a default structure
    return { games: {} };
}

function writeDb(data: Db) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing to db.json:", error);
    }
}


function generateGameId(): string {
    const db = readDb();
    let id = '';
    do {
        id = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (db.games[id]); // Ensure ID is unique
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
    
    const db = readDb();
    db.games[gameId] = initialGameState;
    writeDb(db);

    return initialGameState;
};

export const joinGame = async (gameId: string, playerName: string): Promise<{updatedState: GameState, newPlayerId: number}> => {
    const db = readDb();
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
    
    // If the lobby is now full, deal the cards
    if (updatedPlayers.length === game.playerCount) {
        const dealtPlayers = dealCards(game.deck, updatedPlayers);
        updatedState = { ...updatedState, players: dealtPlayers };
    }

    db.games[gameId.toUpperCase()] = updatedState;
    writeDb(db);
    
    return { updatedState, newPlayerId };
};

export const getGameState = async (gameId: string): Promise<GameState | null> => {
    const db = readDb();
    return db.games[gameId.toUpperCase()] || null;
}

export const updateGameState = async (newState: GameState): Promise<GameState> => {
    const db = readDb();
    if (!db.games[newState.id]) {
        throw new Error("Game not found to update.");
    }
    db.games[newState.id] = newState;
    writeDb(db);

    return newState;
}
