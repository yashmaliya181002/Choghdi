export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type GamePhase = 'setup' | 'bidding' | 'partner-selection' | 'playing' | 'results';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // e.g., 'AS' for Ace of Spades
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isBidder: boolean;
  isPartner: boolean;
  collectedCards: Card[];
  score: number;
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
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const getCardPoints = (card: Card): number => {
    if (card.suit === 'spades' && card.rank === '3') return 30;
    if (['A', 'K', 'Q', 'J', '10'].includes(card.rank)) return 10;
    if (card.rank === '5') return 5;
    return 0;
};

export const createDeck = (playerCount: number): Card[] => {
  let standardDeck: Card[] = SUITS.flatMap(suit =>
    RANKS.map(rank => ({
      suit,
      rank,
      id: `${rank.charAt(0)}${suit.charAt(0).toUpperCase()}`
    }))
  );

  switch (playerCount) {
    case 5:
      return standardDeck.filter(c => c.id !== '2D' && c.id !== '2C');
    case 6:
      return standardDeck.filter(c => c.rank !== '2' && c.rank !== '3'); // Remove 2s and 3s (except 3S)
    case 8:
       return [...standardDeck, ...standardDeck].filter(c => c.rank !== '2'); // Double deck for 8p
    case 7:
      return standardDeck.filter(c => c.id !== '2H' && c.id !== '2D' && c.id !== '2C');
    case 4:
    default:
      return standardDeck;
  }
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const dealCards = (deck: Card[], playerCount: number): Player[] => {
  const shuffledDeck = shuffleDeck(deck);
  const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
    id: i,
    name: i === 0 ? 'You' : `AI ${i}`,
    hand: [],
    isBidder: false,
    isPartner: false,
    collectedCards: [],
    score: 0,
  }));

  let cardIndex = 0;
  while (cardIndex < shuffledDeck.length) {
    for (let i = 0; i < playerCount && cardIndex < shuffledDeck.length; i++) {
      players[i].hand.push(shuffledDeck[cardIndex]);
      cardIndex++;
    }
  }

  // Sort user's hand for better readability
  const suitOrder: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  const rankOrder: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  players[0].hand.sort((a, b) => {
    if (a.suit !== b.suit) {
      return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    }
    return rankOrder.indexOf(b.rank) - rankOrder.indexOf(a.rank);
  });


  return players;
};

export const getNumberOfPartners = (playerCount: number): number => {
    if (playerCount <= 5) return 1;
    if (playerCount <= 7) return 2;
    if (playerCount === 8) return 3;
    return 0;
};
