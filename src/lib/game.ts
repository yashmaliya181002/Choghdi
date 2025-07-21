
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type GamePhase = 'lobby' | 'bidding' | 'partner-selection' | 'playing' | 'results';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // e.g., 'AS' for Ace of Spades
}

export interface Player {
  id: number;
  peerId: string;
  name: string;
  hand: Card[];
  isBidder: boolean;
  isPartner: boolean;
  isHost: boolean;
  collectedCards: Card[];
  tricksWon: number;
}

export interface Bid {
  playerId: number;
  amount: number;
}

export interface Trick {
  cards: { playerId: number; card: Card }[];
  leadingSuit: Suit | null;
}

export interface GameState {
  id: string; // Game room code
  roomCode?: string; // Explicitly add roomCode
  phase: GamePhase;
  players: Player[];
  playerCount: number;
  deck: Card[];
  bids: Bid[];
  highestBid: Bid | null;
  trumpSuit: Suit | null;
  partnerCards: Card[];
  currentPlayerId: number;
  currentTrick: Trick;
  tricksPlayed: number;
  team1Score: number;
  team2Score: number;
  turnHistory: string[];
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const getCardPoints = (card: Card): number => {
    if (card.suit === 'spades' && card.rank === '3') return 30;
    if (['A', 'K', 'Q', 'J', '10'].includes(card.rank)) return 10;
    if (card.rank === '5') return 5;
    return 0;
};

export const createDeck = (): Card[] => {
  return SUITS.flatMap(suit =>
    RANKS.map(rank => ({
      suit,
      rank,
      id: `${rank.length > 1 ? rank.charAt(0) : rank}${suit.charAt(0).toUpperCase()}`
    }))
  );
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const dealCards = (deck: Card[], players: Player[]): Player[] => {
  const playerCount = players.length;
  const shuffledDeck = shuffleDeck(deck);
  const updatedPlayers = players.map(p => ({...p, hand: []}));

  const cardsPerPlayer = Math.floor(shuffledDeck.length / playerCount);

  let cardIndex = 0;
  for (let i = 0; i < playerCount; i++) {
    updatedPlayers[i].hand = shuffledDeck.slice(cardIndex, cardIndex + cardsPerPlayer);
    cardIndex += cardsPerPlayer;
  }

  // Sort hands for better readability
  const suitOrder: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  const rankOrderValue: Record<Rank, number> = {'A':14, 'K':13, 'Q':12, 'J':11, '10':10, '9':9, '8':8, '7':7, '6':6, '5':5, '4':4, '3':3, '2':2};
  
  updatedPlayers.forEach(p => {
    p.hand.sort((a, b) => {
      if (a.suit !== b.suit) {
        return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      }
      return rankOrderValue[b.rank] - rankOrderValue[a.rank];
    });
  });


  return updatedPlayers;
};

export const getNumberOfPartners = (playerCount: number): number => {
    if (playerCount <= 5) return 1;
    if (playerCount <= 7) return 2;
    if (playerCount === 8) return 3;
    return 1; // Default
};
