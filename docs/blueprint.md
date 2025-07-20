# **App Name**: Kaali Teeri Online

## Core Features:

- Deck Initialization: Determine the number of players and remove the respective number of 2's (and 3 of spades) from the deck based on rules.
- Card Dealing: Distribute cards to each player according to the number of players, maintaining card secrecy.
- Bidding System: Enable bidding functionality starting from 120, with a minimum increment of 5. Implement input validation.
- Trump & Partner Selection: Allow the highest bidder to select a trump suit (clubs, hearts, spades, diamonds) and call partner(s) by specifying a card or cards. UI must provide suitable selection controls and enforce card uniqueness when choosing partners.
- Hand Display: Display the current hand to each player, showing only the user's cards and cards played on the table.
- Gameplay Logic: Enforce card play rules, including suit following, trumping, and determining the hand winner based on card ranks. Keep track of which player starts the next round.
- Score Calculation & Win Condition: Track and display team scores based on collected card points (Aces, Kings, Queens, Jacks, Tens = 10, Fives = 5, 3 of spades = 30). Determine and declare the winning team based on point comparison against the bid.

## Style Guidelines:

- Primary color: Deep indigo (#4B0082) to evoke a sense of strategy and sophistication, reminiscent of traditional card playing environments.
- Background color: Very light lavender (#E6E6FA), desaturated to provide a subtle, non-distracting backdrop.
- Accent color: Warm coral (#FF7F50), offering a pop of vibrancy that complements the indigo, highlighting interactive elements such as buttons and score displays.
- Body and headline font: 'Inter', a sans-serif font that provides excellent readability on screens.
- Use custom card suit icons, designed to be modern and easily recognizable.
- Design the layout to mimic a card table, placing player cards at the bottom and played cards in the center. Make it responsive and accessible on different screen sizes
- Incorporate smooth card dealing and playing animations to enhance user experience and provide visual feedback.