'use server';
/**
 * @fileOverview An AI agent for playing a card in the Kaali Teeri card game.
 * - decideCardPlay - A function that handles the AI card playing process.
 * - PlayCardInput - The input type for the decideCardPlay function.
 * - PlayCardOutput - The return type for the decideCardPlay function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CardSchema = z.object({
    suit: z.enum(['spades', 'hearts', 'diamonds', 'clubs']),
    rank: z.enum(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']),
    id: z.string(),
});

const TrickCardSchema = z.object({
    playerId: z.number(),
    card: CardSchema,
});

const PlayCardInputSchema = z.object({
  hand: z.array(CardSchema).describe("The AI player's current hand."),
  trumpSuit: z.enum(['spades', 'hearts', 'diamonds', 'clubs']).describe('The declared trump suit for the round.'),
  currentTrick: z.object({
    cards: z.array(TrickCardSchema).describe('The cards already played in the current trick.'),
    leadingSuit: z.enum(['spades', 'hearts', 'diamonds', 'clubs']).nullable().describe('The suit that led the current trick. Null if this is the first card of the trick.'),
  }),
  isBidderTeam: z.boolean().describe('Whether the current player is on the bidding team.'),
});
export type PlayCardInput = z.infer<typeof PlayCardInputSchema>;

const PlayCardOutputSchema = z.object({
    cardId: z.string().describe('The ID of the card to play from the hand.'),
});
export type PlayCardOutput = z.infer<typeof PlayCardOutputSchema>;


export async function decideCardPlay(input: PlayCardInput): Promise<PlayCardOutput> {
  return decideCardPlayFlow(input);
}

const prompt = ai.definePrompt({
  name: 'playCardPrompt',
  input: {schema: PlayCardInputSchema},
  output: {schema: PlayCardOutputSchema},
  prompt: `You are an expert Kaali Teeri (a trick-taking card game) player. Your task is to choose the best card to play from your hand.

Game Rules for Playing Cards:
- You MUST follow the leading suit if you have a card of that suit.
- If you cannot follow suit, you can play any card, including a trump card.
- The highest-ranking card of the leading suit wins the trick, unless a trump card is played.
- If trump cards are played, the highest-ranking trump card wins the trick.
- Winning tricks with high-point cards (3 of Spades-30, A/K/Q/J/10-10, 5-5) is how you score.

Your Situation:
- Your Hand:
{{#each hand}}
  - {{rank}} of {{suit}} (id: {{id}})
{{/each}}
- Trump Suit: {{trumpSuit}}
- You are {{#if isBidderTeam}}on the bidding team{{else}}on the opponent team{{/if}}.
- Current Trick:
{{#if currentTrick.cards.length}}
  {{#each currentTrick.cards}}
    - Player {{playerId}} played {{card.rank}} of {{card.suit}}
  {{/each}}
  - Leading Suit: {{currentTrick.leadingSuit}}
{{else}}
  - You are leading the trick.
{{/if}}

Your Task:
Select the ID of the card you wish to play. You must provide the 'cardId' from your hand.

Strategic Considerations:
1.  **Leading the Trick:** If you are leading, decide whether to draw out trumps, establish a strong suit, or try to cash in a high-value card.
2.  **Following Suit:**
    - If you must follow suit and can win the trick, play your highest card of that suit to secure the points.
    - If you must follow suit but cannot win, play your lowest-value card of that suit to save your better cards.
3.  **Cannot Follow Suit (Trump Opportunity):**
    - If you are out of the leading suit, consider playing a trump card to win the trick, especially if it contains many points.
    - If you are on the bidder's team, you want to win tricks with points.
    - If you are on the opponent's team, you want to prevent the bidder's team from winning points.
4.  **Cannot Follow Suit (Discarding):** If you can't follow suit and don't want to/can't trump, discard a low-value card from a different suit.

Based on these rules and strategies, analyze your hand and the current trick, then choose the best card to play.`,
});

const decideCardPlayFlow = ai.defineFlow(
  {
    name: 'decideCardPlayFlow',
    inputSchema: PlayCardInputSchema,
    outputSchema: PlayCardOutputSchema,
  },
  async input => {
    // Filter hand to only valid plays
    const { hand, currentTrick } = input;
    const leadingSuit = currentTrick.leadingSuit;
    
    let possiblePlays = hand;
    if (leadingSuit && hand.some(c => c.suit === leadingSuit)) {
      possiblePlays = hand.filter(c => c.suit === leadingSuit);
    }
    
    // If only one possible play, just return it.
    if (possiblePlays.length === 1) {
        return { cardId: possiblePlays[0].id };
    }

    // Pass the filtered hand to the AI if there's a choice to be made.
    const modifiedInput = {...input, hand: possiblePlays };

    const {output} = await prompt(modifiedInput);
    
    // Fallback logic in case AI returns an invalid card
    const chosenCard = hand.find(c => c.id === output?.cardId);
    if (chosenCard && possiblePlays.some(p => p.id === chosenCard.id)) {
        return output!;
    }
    
    // If AI fails, play the first valid card
    return { cardId: possiblePlays[0].id };
  }
);
