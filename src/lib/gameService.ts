'use server';

import { createDeck, dealCards, type GameState, type Player } from './game';

// This service now sets up a single-player vs AI game.
// No database or shared state is needed.

function generateGameId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const createNewGame = async (playerCount: number, humanPlayerName: string): Promise<GameState> => {
    const gameId = generateGameId();
    const deck = createDeck(playerCount);

    const players: Player[] = [];
    
    // Add the human player
    players.push({
        id: 0,
        name: humanPlayerName,
        hand: [],
        isBidder: false,
        isPartner: false,
        collectedCards: [],
        tricksWon: 0,
    });

    // Add AI players
    for (let i = 1; i < playerCount; i++) {
        players.push({
            id: i,
            name: `Bot ${i}`,
            hand: [],
            isBidder: false,
            isPartner: false,
            collectedCards: [],
            tricksWon: 0,
        });
    }

    const dealtPlayers = dealCards(deck, players);
    
    const initialGameState: GameState = {
        id: gameId,
        phase: 'bidding',
        playerCount,
        players: dealtPlayers,
        deck,
        bids: [],
        highestBid: null,
        trumpSuit: null,
        partnerCards: [],
        currentPlayerId: 0, // Human player starts bidding
        currentTrick: { cards: [], leadingSuit: null },
        tricksPlayed: 0,
        team1Score: 0,
        team2Score: 0,
        turnHistory: [],
    };
    
    return initialGameState;
};

// No longer needed for single-player vs AI
export const joinGame = async (gameId: string, playerName: string): Promise<{updatedState: GameState, newPlayerId: number}> => {
    throw new Error("This functionality is disabled in Player vs. AI mode.");
};

export const getGameState = async (gameId: string): Promise<GameState | null> => {
     throw new Error("This functionality is disabled in Player vs. AI mode.");
}

export const updateGameState = async (newState: GameState): Promise<GameState> => {
     // In a single player setup, this function might not even be needed,
     // as state can be managed on the client.
     // But we'll keep it for consistency in case of future changes.
    return newState;
}
