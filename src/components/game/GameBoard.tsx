'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createDeck, dealCards, type GameState, type Player, type Card, getNumberOfPartners, getCardPoints } from '@/lib/game';
import { CardUI } from './CardUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SpadeIcon, HeartIcon, ClubIcon, DiamondIcon } from './SuitIcons';
import { Crown, Users, Bot } from 'lucide-react';
import Confetti from 'react-confetti';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { decideBid, type BiddingInput } from '@/ai/flows/bidding-flow';
import { decideCardPlay, type PlayCardInput } from '@/ai/flows/play-card-flow';


const SuitSelectIcon = ({ suit }: { suit: 'spades' | 'hearts' | 'clubs' | 'diamonds' }) => {
    const commonClass = "w-5 h-5 mr-2";
    switch(suit) {
        case 'spades': return <SpadeIcon className={commonClass} />;
        case 'hearts': return <HeartIcon className={commonClass} />;
        case 'clubs': return <ClubIcon className={commonClass} />;
        case 'diamonds': return <DiamondIcon className={commonClass} />;
    }
}

export default function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [bidAmount, setBidAmount] = useState(120);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [selectedTrump, setSelectedTrump] = useState<'spades' | 'hearts' | 'clubs' | 'diamonds' | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);


  const { toast } = useToast();

  const playerPositions = useMemo(() => {
    if (!gameState) return [];
    const positions = [];
    const radiusX = windowSize.width * 0.35;
    const radiusY = windowSize.height * 0.3;
    const centerX = windowSize.width / 2;
    const centerY = windowSize.height / 2 - 50;
    
    for (let i = 1; i < gameState.playerCount; i++) {
        const angle = (i / (gameState.playerCount-1)) * Math.PI * 1.5 - Math.PI * 1.25;
        positions.push({
            top: `${centerY + radiusY * Math.sin(angle)}px`,
            left: `${centerX + radiusX * Math.cos(angle)}px`,
        });
    }
    return positions;
  }, [gameState?.playerCount, windowSize]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  // Game loop effect
  useEffect(() => {
    if (!gameState || isProcessing) return;

    const currentPlayer = gameState.players[gameState.currentPlayerId];
    if (currentPlayer.id === 0) return; // Human player's turn

    const processAiTurn = async () => {
        setIsProcessing(true);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pause for effect

        if (gameState.phase === 'bidding') {
            const currentHighestBid = gameState.highestBid?.amount || 115;
            const input: BiddingInput = { 
                player: currentPlayer, 
                currentHighestBid: currentHighestBid,
                playerCount: gameState.playerCount
            };
            try {
                const { decision, amount } = await decideBid(input);
                if (decision === 'bid' && amount) {
                    toast({title: `${currentPlayer.name} bids ${amount}`})
                    handlePlaceBid(amount, currentPlayer.id);
                } else {
                    toast({title: `${currentPlayer.name} passes`})
                    handlePass(currentPlayer.id);
                }
            } catch (error) {
                console.error("AI bidding error:", error);
                handlePass(currentPlayer.id); // Default to passing on error
            }

        } else if (gameState.phase === 'playing') {
            const input: PlayCardInput = {
                hand: currentPlayer.hand,
                trumpSuit: gameState.trumpSuit!,
                currentTrick: gameState.currentTrick,
                isBidderTeam: !!(currentPlayer.isBidder || currentPlayer.isPartner),
            };
            try {
                const { cardId } = await decideCardPlay(input);
                const cardToPlay = currentPlayer.hand.find(c => c.id === cardId);
                if (cardToPlay) {
                    toast({ title: `${currentPlayer.name} plays ${cardToPlay.rank} of ${cardToPlay.suit}`});
                    handlePlayCard(cardToPlay, currentPlayer.id);
                } else {
                     // Failsafe
                    handlePlayCard(currentPlayer.hand[0], currentPlayer.id);
                }
            } catch (error) {
                console.error("AI playing error:", error);
                // Failsafe: play the first valid card
                const { hand, currentTrick } = input;
                const leadingSuit = currentTrick.leadingSuit;
                let possiblePlays = hand;
                if (leadingSuit && hand.some(c => c.suit === leadingSuit)) {
                    possiblePlays = hand.filter(c => c.suit === leadingSuit);
                }
                handlePlayCard(possiblePlays[0], currentPlayer.id);
            }
        }
        setIsProcessing(false);
    };

    processAiTurn();

  }, [gameState, isProcessing]);

  const handleStartGame = (playerCount: number) => {
    const deck = createDeck(playerCount);
    const players = dealCards(deck, playerCount);
    setGameState({
      phase: 'bidding',
      playerCount,
      players,
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
    });
    setBidAmount(120);
  };
  
  const handlePlaceBid = (amount: number, playerId: number) => {
    if (!gameState || !gameState.players) return;
    
    if (playerId === 0) { // Human player validation
        const currentHighestBid = gameState.highestBid?.amount || 115;
        if (amount < currentHighestBid + 5) {
          toast({
            variant: "destructive",
            title: "Invalid Bid",
            description: `Your bid must be at least ${currentHighestBid + 5}.`,
          });
          return;
        }
    }

    const newBids = [...gameState.bids, { playerId: playerId, amount: amount }];
    const nextPlayerId = (playerId + 1) % gameState.playerCount;

    setGameState(prev => {
        if (!prev) return null;
        const updatedState: GameState = {
            ...prev,
            bids: newBids,
            highestBid: { playerId: playerId, amount: amount },
            currentPlayerId: nextPlayerId,
        };

        if (newBids.length >= prev.playerCount) {
            return finishBidding(updatedState);
        }
        return updatedState;
    });
  };

  const handlePass = (playerId: number) => {
    if (!gameState) return;
    const newBids = [...gameState.bids, { playerId: playerId, amount: 0 }]; // 0 for pass
    const nextPlayerId = (playerId + 1) % gameState.playerCount;

    setGameState(prev => {
        if (!prev) return null;
        const updatedState = { ...prev, bids: newBids, currentPlayerId: nextPlayerId };
        if (newBids.length >= prev.playerCount) {
            return finishBidding(updatedState);
        }
        return updatedState;
    });
  };

  const finishBidding = (currentState: GameState): GameState => {
    if(!currentState.highestBid){
        // Everyone passed, restart or handle this case
        toast({ title: "Everyone Passed!", description: "Restarting bid." });
        return {
            ...currentState,
            phase: 'bidding',
            bids: [],
            currentPlayerId: 0,
        };
     }
     const bidder = currentState.players.find(p => p.id === currentState.highestBid!.playerId);
     if(bidder) bidder.isBidder = true;

     const finalState = { 
        ...currentState,
         phase: 'partner-selection',
         currentPlayerId: currentState.highestBid!.playerId,
     }

     if (finalState.currentPlayerId === 0) {
        setShowPartnerDialog(true);
     } else {
        // TODO: AI needs to select partners
        // For now, auto-select for AI
        const bidderHand = finalState.players[finalState.currentPlayerId].hand;
        const potentialTrump = (['spades', 'hearts', 'clubs', 'diamonds'] as const).sort((a,b) => 
            bidderHand.filter(c => c.suit === b).length - bidderHand.filter(c => c.suit === a).length
        )[0];
        const partnerCount = getNumberOfPartners(finalState.playerCount);
        const potentialPartners = finalState.deck
            .filter(c => !bidderHand.some(hc => hc.id === c.id))
            .filter(c => c.rank === 'A' || c.rank === 'K'); // Simple logic: pick Aces/Kings
        
        const partnerCards = potentialPartners.slice(0, partnerCount);

        toast({ title: "Partner Selection", description: `${bidder?.name} chose ${potentialTrump} as trump and called for ${partnerCards.map(c => `${c.rank} of ${c.suit}`).join(', ')}`})
        
        return confirmPartners(finalState, potentialTrump, partnerCards);
     }

     return finalState;
  }
  
  const confirmPartners = (currentState: GameState, trump: Card['suit'], partnerCards: Card[]): GameState => {
      const updatedPlayers = currentState.players.map(p => {
          if (p.hand.some(cardInHand => partnerCards.some(pc => pc.id === cardInHand.id))) {
              return { ...p, isPartner: true };
          }
          return p;
      });
      return { ...currentState, phase: 'playing', trumpSuit: trump, partnerCards, players: updatedPlayers };
  }


  const handleConfirmPartners = () => {
      if(!gameState || !selectedTrump || selectedPartners.length < getNumberOfPartners(gameState.playerCount)) {
          toast({ variant: "destructive", title: "Selection Incomplete", description: "Please select a trump suit and partner card(s)."});
          return;
      }

      const partnerCards = gameState.deck.filter(c => selectedPartners.includes(c.id));
      
      setGameState(prev => {
          if(!prev) return null;
          return confirmPartners(prev, selectedTrump, partnerCards);
      });

      setShowPartnerDialog(false);
  }

  const handlePlayCard = (card: Card, playerId: number) => {
    if (!gameState || gameState.phase !== 'playing' || playerId !== gameState.currentPlayerId) return;

    const player = gameState.players[playerId];
    const trick = gameState.currentTrick;
    const leadingSuit = trick.leadingSuit;

    // Rule: Must follow suit if possible
    if (playerId === 0 && leadingSuit && player.hand.some(c => c.suit === leadingSuit) && card.suit !== leadingSuit) {
        toast({ variant: "destructive", title: "Invalid Move", description: `You must play a ${leadingSuit} card.` });
        return;
    }

    const newHand = player.hand.filter(c => c.id !== card.id);
    const newTrick = { ...trick, cards: [...trick.cards, { playerId: player.id, card }] };
    if (!newTrick.leadingSuit) {
        newTrick.leadingSuit = card.suit;
    }
    
    const updatedPlayers = [...gameState.players];
    updatedPlayers[player.id] = { ...player, hand: newHand };
    
    let nextPlayerId = (gameState.currentPlayerId + 1) % gameState.playerCount;
    
    setGameState(prev => ({...prev!, players: updatedPlayers, currentTrick: newTrick, currentPlayerId: nextPlayerId }));

    // If trick is complete
    if (newTrick.cards.length === gameState.playerCount) {
        setIsProcessing(true);
        setTimeout(() => processTrick(newTrick), 1500);
    }
  };

  const processTrick = (trick: any) => {
      if (!gameState || !gameState.trumpSuit) return;
      
      let winner = trick.cards[0];
      for(let i = 1; i < trick.cards.length; i++) {
          const currentCardInfo = trick.cards[i];
          const winnerCard = winner.card;
          const currentCard = currentCardInfo.card;
          
          const RANKS_ORDER: any = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14};
          
          if(currentCard.suit === gameState.trumpSuit && winnerCard.suit !== gameState.trumpSuit) {
              winner = currentCardInfo;
          } else if(currentCard.suit === winnerCard.suit) {
              if (RANKS_ORDER[currentCard.rank] > RANKS_ORDER[winnerCard.rank]) {
                  winner = currentCardInfo;
              }
          }
      }

      const winningPlayer = gameState.players.find(p => p.id === winner.playerId)!;
      toast({ title: `${winningPlayer.name} wins the trick!`, description: `With the ${winner.card.rank} of ${winner.card.suit}`});

      const collectedCards = trick.cards.map((c: any) => c.card);
      const points = collectedCards.reduce((acc: number, c: Card) => acc + getCardPoints(c), 0);
      
      const isTeam1 = winningPlayer.isBidder || winningPlayer.isPartner;

      setGameState(prev => {
          if(!prev) return null;
          
          const updatedPlayers = prev.players.map(p => p.id === winner.playerId ? {...p, collectedCards: [...p.collectedCards, ...collectedCards]} : p);
          
          const tricksPlayed = prev.tricksPlayed + 1;
          const maxTricks = prev.deck.length / prev.playerCount;

          if (tricksPlayed === maxTricks) {
              setTimeout(() => setShowResults(true), 1000);
          }

          return {
            ...prev,
            players: updatedPlayers,
            currentTrick: { cards: [], leadingSuit: null },
            currentPlayerId: winner.playerId,
            team1Score: isTeam1 ? prev.team1Score + points : prev.team1Score,
            team2Score: !isTeam1 ? prev.team2Score + points : prev.team2Score,
            tricksPlayed: tricksPlayed,
            phase: tricksPlayed === maxTricks ? 'results' : prev.phase
          };
      });
      setIsProcessing(false);
  }
  
  const resetGame = () => {
      setGameState(null);
      setShowResults(false);
  }

  const renderSetup = () => (
    <div className="w-full h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-card p-8 rounded-2xl shadow-2xl text-center">
        <h1 className="text-4xl font-bold font-headline text-primary mb-2">Kaali Teeri Online</h1>
        <p className="text-muted-foreground mb-8">The classic card game, brought online.</p>
        <div className="space-y-4">
          <Label htmlFor="player-count" className="text-lg">How many players?</Label>
          <Select onValueChange={(val) => handleStartGame(parseInt(val))}>
            <SelectTrigger id="player-count" className="w-full text-lg h-12">
              <SelectValue placeholder="Select player count..." />
            </SelectTrigger>
            <SelectContent>
              {[4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>{n} Players</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </motion.div>
    </div>
  );

  const renderGame = () => {
    if (!gameState) return null;
    const { players, playerCount, currentPlayerId } = gameState;
    const user = players[0];

    return (
        <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-background to-indigo-100 p-4">
          {/* Other Players */}
          {players.slice(1).map((p, i) => (
            <motion.div 
              key={p.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              initial={{opacity: 0}}
              animate={{ opacity: 1, ...playerPositions[i] }}
              transition={{duration: 0.5}}
            >
              <div className="flex flex-col items-center gap-2">
                 <Badge variant={p.id === currentPlayerId ? 'destructive' : 'secondary'} className="px-3 py-1 text-sm transition-all">
                    <Bot className="w-4 h-4 mr-1" /> {p.name}
                 </Badge>
                 <Avatar className={cn("border-4", p.id === currentPlayerId ? 'border-accent' : 'border-transparent')}>
                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex gap-1">
                    {Array(p.hand.length).fill(0).map((_, idx) => (
                        <CardUI key={idx} className="!w-6 !h-9" />
                    ))}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Table Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
            <div className="flex gap-2 items-center">
                <div className="p-3 bg-card/80 rounded-lg shadow-md text-center">
                    <h3 className="text-sm font-bold text-primary">Bidder Team</h3>
                    <p className="text-2xl font-bold">{gameState.team1Score}</p>
                </div>
                <div className="p-3 bg-card/80 rounded-lg shadow-md text-center">
                    <h3 className="text-sm font-bold text-secondary-foreground">Opponents</h3>
                    <p className="text-2xl font-bold">{gameState.team2Score}</p>
                </div>
            </div>
            {gameState.phase === 'playing' && (
            <div className="flex items-center justify-center w-72 h-48 bg-black/10 rounded-2xl border-2 border-dashed border-white/20 p-4">
                <div className="flex relative w-full h-full">
                {gameState.currentTrick.cards.map(({card, playerId}, index) => (
                    <div key={index} className="absolute" style={{left: `${index * 20}%`, top: '50%', transform: 'translateY(-50%)'}}>
                        <CardUI card={card} isFaceUp={true} className="!w-20 !h-28" />
                    </div>
                ))}
                </div>
            </div>
            )}
            {(isProcessing && gameState.currentPlayerId !== 0) && (
                <div className="text-center p-4 bg-card/80 rounded-lg shadow-lg">
                    <p className="text-muted-foreground animate-pulse">Thinking...</p>
                </div>
            )}
            {gameState.phase === 'bidding' && gameState.currentPlayerId !== 0 && !isProcessing && (
                <div className="text-center p-4 bg-card/80 rounded-lg shadow-lg">
                    <p className="text-muted-foreground">Waiting for {players[currentPlayerId].name} to bid...</p>
                    {gameState.highestBid && <p>Current bid: <span className="font-bold text-primary">{gameState.highestBid.amount}</span> by {players[gameState.highestBid.playerId].name}</p>}
                </div>
            )}
          </div>

          {/* User's Hand & Area */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full flex flex-col items-center">
             {/* Bidding UI */}
            {gameState.phase === 'bidding' && currentPlayerId === 0 && !isProcessing && (
                <motion.div initial={{y:50, opacity:0}} animate={{y:0, opacity:1}} className="bg-card p-4 rounded-t-lg shadow-lg flex items-center gap-4">
                    <h3 className="text-lg font-bold">Your Bid:</h3>
                    <Input type="number" value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))} step={5} className="w-32" />
                    <Button onClick={() => handlePlaceBid(bidAmount, 0)}>Place Bid</Button>
                    <Button variant="outline" onClick={() => handlePass(0)}>Pass</Button>
                </motion.div>
            )}
            <div className="flex justify-center items-end p-4" style={{ minHeight: '180px' }}>
              <AnimatePresence>
              {user.hand.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 50, rotate: (i - user.hand.length / 2) * 5 }}
                  animate={{ opacity: 1, y: 0, x: (i - user.hand.length / 2) * 30 }}
                  exit={{ opacity: 0, y: 100 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 25, delay: i * 0.05 }}
                  style={{ zIndex: i }}
                  className="absolute bottom-4"
                >
                  <CardUI card={card} isFaceUp={true} isPlayable={gameState.phase === 'playing' && currentPlayerId === 0 && !isProcessing} onClick={() => gameState.phase === 'playing' && currentPlayerId === 0 && !isProcessing && handlePlayCard(card, 0)} />
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
            <div className="bg-card/80 p-2 rounded-t-lg shadow-inner flex items-center gap-2">
                <Avatar><AvatarFallback>Y</AvatarFallback></Avatar>
                <p className="font-bold">{user.name}</p>
                {user.isBidder && <Badge><Crown className="w-4 h-4 mr-1" />Bidder</Badge>}
                {user.isPartner && <Badge variant="secondary"><Users className="w-4 h-4 mr-1"/>Partner</Badge>}
                {gameState.trumpSuit && (
                    <Badge variant="outline" className="flex items-center">
                        Trump: <SuitSelectIcon suit={gameState.trumpSuit} />
                    </Badge>
                )}
            </div>
          </div>
          
          {/* Partner Selection Dialog */}
          <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Trump and Partners</DialogTitle>
                <DialogDescription>
                  You won the bid with {gameState.highestBid?.amount}! Choose your trump suit and call your partners.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="font-bold">Trump Suit</Label>
                  <Select onValueChange={(v: any) => setSelectedTrump(v)}>
                    <SelectTrigger><SelectValue placeholder="Select a suit..." /></SelectTrigger>
                    <SelectContent>
                      {(['spades', 'hearts', 'clubs', 'diamonds'] as const).map(suit => (
                        <SelectItem key={suit} value={suit}>
                            <div className="flex items-center"><SuitSelectIcon suit={suit} /> {suit.charAt(0).toUpperCase() + suit.slice(1)}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-bold">Partner(s)</Label>
                  <p className="text-sm text-muted-foreground mb-2">Select {getNumberOfPartners(playerCount)} card(s).</p>
                  {Array.from({length: getNumberOfPartners(playerCount)}).map((_, i) => (
                    <Select key={i} onValueChange={val => {
                        const newPartners = [...selectedPartners];
                        newPartners[i] = val;
                        setSelectedPartners(newPartners);
                    }}>
                        <SelectTrigger className="mb-2"><SelectValue placeholder={`Select partner card ${i+1}...`} /></SelectTrigger>
                        <SelectContent>
                        {gameState.deck
                            .filter(c => !user.hand.find(hc => hc.id === c.id))
                            .filter(c => !selectedPartners.includes(c.id) || selectedPartners[i] === c.id)
                            .map(card => (
                            <SelectItem key={card.id} value={card.id}>
                                {card.rank} of {card.suit}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleConfirmPartners}>Confirm and Start Game</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Results Dialog */}
          <Dialog open={showResults} onOpenChange={setShowResults}>
            <DialogContent>
                {gameState.phase === 'results' && (
                    <AnimatePresence>
                        {(gameState.team1Score >= gameState.highestBid!.amount) && 
                            <Confetti width={windowSize.width} height={windowSize.height} recycle={false} />
                        }
                    </AnimatePresence>
                )}
              <DialogHeader>
                <DialogTitle>Game Over!</DialogTitle>
              </DialogHeader>
                {gameState.highestBid && (
                    <div className="text-center">
                        <h3 className="text-xl font-bold font-headline mb-4">
                            {gameState.team1Score >= gameState.highestBid.amount ? 'Bidder Team Wins!' : 'Opponents Win!'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-left">
                            <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-bold text-primary">Bidder Team</h4>
                                <p>Bid: {gameState.highestBid.amount}</p>
                                <p>Scored: {gameState.team1Score}</p>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-bold">Opponent Team</h4>
                                <p>Needed: {250 - gameState.highestBid.amount + 5}</p>
                                <p>Scored: {gameState.team2Score}</p>
                            </div>
                        </div>
                    </div>
                )}
              <DialogFooter className="mt-4">
                <Button onClick={resetGame} className="w-full">Play Again</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
    );
  };

  return gameState ? renderGame() : renderSetup();
}
