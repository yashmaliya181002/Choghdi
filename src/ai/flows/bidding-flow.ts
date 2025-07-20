'use server';
/**
 * @fileOverview An AI agent for making bids in the Kaali Teeri card game.
 * - decideBid - A function that handles the AI bidding process.
 * - BiddingInput - The input type for the decideBid function.
 * - BiddingOutput - The return type for the decideBid function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { Card, Player } from '@/lib/game';

const CardSchema = z.object({
    suit: z.enum(['spades', 'hearts', 'diamonds', 'clubs']),
    rank: z.enum(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']),
    id: z.string(),
});

const PlayerSchema = z.object({
  id: z.number(),
  name: z.string(),
  hand: z.array(CardSchema),
  isBidder: z.boolean(),
  isPartner: z.boolean(),
  collectedCards: z.array(CardSchema),
});

const BiddingInputSchema = z.object({
  player: PlayerSchema,
  currentHighestBid: z.number().optional(),
  playerCount: z.number(),
});
export type BiddingInput = z.infer<typeof BiddingInputSchema>;

const BiddingOutputSchema = z.object({
    decision: z.enum(['bid', 'pass']),
    amount: z.number().optional().describe('The amount to bid. Must be a multiple of 5 and higher than the current highest bid. A reasonable bid is between 120 and 250.'),
});
export type BiddingOutput = z.infer<typeof BiddingOutputSchema>;

export async function decideBid(input: BiddingInput): Promise<BiddingOutput> {
  return decideBidFlow(input);
}

const prompt = ai.definePrompt({
  name: 'biddingPrompt',
  input: {schema: BiddingInputSchema},
  output: {schema: BiddingOutputSchema},
  prompt: `You are an expert Kaali Teeri (a trick-taking card game) player. Your task is to decide whether to bid or pass based on your hand.

Game Rules for Bidding:
- The total points in a deck are 250.
- Bids start at 120 and go up in increments of 5.
- The goal of bidding is to secure the right to choose the trump suit and partners. The bidding team must then score at least the bid amount.
- Key cards for scoring are: 3 of Spades (30 points), Aces (10), Kings (10), Queens (10), Jacks (10), 10s (10), and 5s (5).

Your Hand:
{{#each player.hand}}
- {{rank}} of {{suit}}
{{/each}}

Current State:
- Player Count: {{playerCount}}
- Current Highest Bid: {{#if currentHighestBid}}{{currentHighestBid}}{{else}}None (you can start at 120){{/if}}

Your Thought Process:
1.  Evaluate the strength of your hand. Count high-value cards (A, K, Q, J, 10, 5).
2.  Look for long suits (many cards of the same suit), which are good for setting as trump.
3.  Consider the 3 of Spades. If you have it, it's a huge advantage (30 points).
4.  Based on your hand's strength, estimate the number of points you can realistically win. A safe bid is usually a bit lower than your estimate.
5.  If the current highest bid is already very high, it might be better to pass unless your hand is exceptionally strong.
6.  Decide to 'bid' or 'pass'. If you bid, choose an amount that is a multiple of 5 and at least 5 points higher than the current highest bid.

Example Hand Analysis:
Hand: A of Spades, K of Spades, Q of Spades, 5 of Spades, A of Hearts, K of Hearts, 10 of Clubs.
Analysis: Very strong hand. Many high cards in Spades, making it a great trump suit. Points in hand are 10(A)+10(K)+10(Q)+5(5)+10(A)+10(K)+10(10) = 65. With partners, this hand could easily make a high bid, perhaps around 180-200.

Now, analyze the hand provided and make your decision.`,
});

const decideBidFlow = ai.defineFlow(
  {
    name: 'decideBidFlow',
    inputSchema: BiddingInputSchema,
    outputSchema: BiddingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
