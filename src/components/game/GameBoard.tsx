'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createDeck, dealCards, type GameState, type Player, type Card, getNumberOfPartners, getCardPoints, Rank } from '@/lib/game';
import { CardUI } from './CardUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SpadeIcon, HeartIcon, ClubIcon, DiamondIcon } from './SuitIcons';
import { Crown, Users, Bot, Trophy, Info } from 'lucide-react';
import Confetti from 'react-confetti';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
// Note: AI flows are no longer needed for human-vs-human multiplayer.
// import { decideBid } from '@/ai/flows/bidding-flow';
// import type { BiddingInput } from '@/ai/flows/bidding-flow';
// import { decideCardPlay } from '@/ai/flows/play-card-flow';
// import type { PlayCardInput } from '@/ai/flows/play-card-flow';


const SuitSelectIcon = ({ suit }: { suit: Card['suit'] }) => {
    const commonClass = "w-5 h-5 mr-2";
    switch(suit) {
        case 'spades': return <SpadeIcon className={commonClass} />;
        case 'hearts': return <HeartIcon className={commonClass} />;
        case 'clubs': return <ClubIcon className={commonClass} />;
        case 'diamonds': return <DiamondIcon className={commonClass} />;
    }
}

type GameBoardProps = {
    initialGameState: GameState;
    localPlayerId: number;
    // A function to send updates to the "server" would be passed here
    // onGameUpdate: (newState: GameState) => void; 
};

export default function GameBoard({ initialGameState, localPlayerId }: GameBoardProps) {
  // The game state is now managed via props and a "server"
  // For this example, we'll still use some local state and simulate updates.
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [bidAmount, setBidAmount] = useState(120);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [selectedTrump, setSelectedTrump] = useState<Card['suit'] | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTrickWinner, setLastTrickWinner] = useState<Player | null>(null);

  const { toast } = useToast();

  const me = gameState.players.find(p => p.id === localPlayerId)!;
  
  const playerPositions = useMemo(() => {
    if (!gameState) return [];
    
    const otherPlayers = gameState.players.filter(p => p.id !== localPlayerId);
    const positions = [];
    const radiusX = Math.min(windowSize.width * 0.4, 500);
    const radiusY = Math.min(windowSize.height * 0.35, 300);
    const centerX = windowSize.width / 2;
    const centerY = windowSize.height / 2 - 50;
    
    const angleStep = Math.PI * 1.6 / (otherPlayers.length - 1 || 1);
    const startingAngle = -Math.PI * 1.3;

    for (let i = 0; i < otherPlayers.length; i++) {
        const angle = startingAngle + i * angleStep;
        positions.push({
            top: `${centerY + radiusY * Math.sin(angle)}px`,
            left: `${centerX + radiusX * Math.cos(angle)}px`,
        });
    }
    return positions;
  }, [gameState.players, localPlayerId, windowSize]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  const confirmPartners = (currentState: GameState, trump: Card['suit'], partnerCards: Card[]): GameState => {
      const updatedPlayers = currentState.players.map(p => {
          if (p.hand.some(cardInHand => partnerCards.some(pc => pc.id === cardInHand.id))) {
              return { ...p, isPartner: true };
          }
          return p;
      });
      toast({ title: "Partners Selected!", description: `Trump is ${trump}. The game begins!` });
      return { ...currentState, phase: 'playing', trumpSuit: trump, partnerCards, players: updatedPlayers };
  }

  const finishBidding = (currentState: GameState): GameState => {
    if(!currentState.highestBid){
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

     if (finalState.currentPlayerId === localPlayerId) {
        setShowPartnerDialog(true);
     } else {
        toast({ title: "Partner Selection", description: `Waiting for ${bidder?.name} to select partners.`})
     }

     return finalState;
  }

  const handlePlaceBid = useCallback((amount: number, playerId: number) => {
    setGameState(prev => {
      if (!prev || prev.phase !== 'bidding' || playerId !== prev.currentPlayerId) return prev;
      
      const currentHighestBid = prev.highestBid?.amount || 115;
      if (amount < currentHighestBid + 5) {
        toast({
          variant: "destructive",
          title: "Invalid Bid",
          description: `Your bid must be at least ${currentHighestBid + 5}.`,
        });
        return prev;
      }
      if (amount % 5 !== 0) {
        toast({
          variant: "destructive",
          title: "Invalid Bid",
          description: `Your bid must be a multiple of 5.`,
        });
        return prev;
      }

      const newBids = [...prev.bids, { playerId: playerId, amount: amount }];
      const nextPlayerId = (playerId + 1) % prev.playerCount;
      
      let updatedState: GameState = {
          ...prev,
          bids: newBids,
          highestBid: { playerId: playerId, amount: amount },
          currentPlayerId: nextPlayerId,
      };

      if (newBids.length >= prev.playerCount) {
          updatedState = finishBidding(updatedState);
      }
      // onGameUpdate(updatedState);
      return updatedState;
    });
  }, [toast, localPlayerId]);

  const handlePass = useCallback((playerId: number) => {
    setGameState(prev => {
        if (!prev || prev.phase !== 'bidding' || playerId !== prev.currentPlayerId) return prev;
        const newBids = [...prev.bids, { playerId: playerId, amount: 0 }]; // 0 for pass
        const nextPlayerId = (playerId + 1) % prev.playerCount;

        let updatedState = { ...prev, bids: newBids, currentPlayerId: nextPlayerId };
        if (newBids.length >= prev.playerCount) {
            updatedState = finishBidding(updatedState);
        }
        // onGameUpdate(updatedState);
        return updatedState;
    });
  }, [localPlayerId]);

  const processTrick = (currentState: GameState) => {
      if (!currentState || !currentState.trumpSuit || currentState.currentTrick.cards.length !== currentState.playerCount) return;
      
      const trick = currentState.currentTrick;
      
      let winner = trick.cards[0];
      const RANKS_ORDER: Record<Rank, number> = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14};
      
      for(let i = 1; i < trick.cards.length; i++) {
          const currentCardInfo = trick.cards[i];
          const winnerCard = winner.card;
          const currentCard = currentCardInfo.card;
          
          if(currentCard.suit === currentState.trumpSuit && winnerCard.suit !== currentState.trumpSuit) {
              winner = currentCardInfo;
          } else if(currentCard.suit === winnerCard.suit) {
              if (RANKS_ORDER[currentCard.rank] > RANKS_ORDER[winnerCard.rank]) {
                  winner = currentCardInfo;
              }
          }
      }

      const winningPlayer = currentState.players.find(p => p.id === winner.playerId)!;
      toast({ title: `${winningPlayer.name} wins the trick!`, description: `With the ${winner.card.rank} of ${winner.card.suit}`});
      setLastTrickWinner(winningPlayer);

      const collectedCards = trick.cards.map((c: any) => c.card);
      
      setGameState(prev => {
          if(!prev) return null;
          
          const updatedPlayers = prev.players.map(p => 
              p.id === winner.playerId 
              ? {...p, collectedCards: [...p.collectedCards, ...collectedCards], tricksWon: p.tricksWon + 1 } 
              : p
          );
          
          const tricksPlayed = prev.tricksPlayed + 1;
          const maxTricks = prev.deck.length / prev.playerCount;

          let newPhase = prev.phase;
          if (tricksPlayed === maxTricks) {
              newPhase = 'results';
              const bidderTeam = updatedPlayers.filter(p => p.isBidder || p.isPartner);
              const opponentTeam = updatedPlayers.filter(p => !p.isBidder && !p.isPartner);
              
              const team1Score = bidderTeam.reduce((acc, p) => acc + p.collectedCards.reduce((sum, card) => sum + getCardPoints(card), 0), 0);
              const team2Score = opponentTeam.reduce((acc, p) => acc + p.collectedCards.reduce((sum, card) => sum + getCardPoints(card), 0), 0);
              
              setTimeout(() => setShowResults(true), 1500);

              return {
                ...prev,
                players: updatedPlayers,
                currentTrick: { cards: [], leadingSuit: null },
                currentPlayerId: winner.playerId,
                tricksPlayed: tricksPlayed,
                phase: newPhase,
                team1Score,
                team2Score
              };
          }

          // Return to playing phase for next trick
          return {
            ...prev,
            players: updatedPlayers,
            currentTrick: { cards: [], leadingSuit: null },
            currentPlayerId: winner.playerId,
            tricksPlayed: tricksPlayed,
          };
      });
      setIsProcessing(false);
  }

  const handlePlayCard = useCallback((card: Card, playerId: number) => {
    setGameState(prev => {
        if (!prev || prev.phase !== 'playing' || playerId !== prev.currentPlayerId || playerId !== localPlayerId) return prev;

        const player = prev.players.find(p => p.id === playerId);
        if (!player) return prev;

        const trick = prev.currentTrick;
        const leadingSuit = trick.leadingSuit;

        if (leadingSuit && player.hand.some(c => c.suit === leadingSuit) && card.suit !== leadingSuit) {
            toast({ variant: "destructive", title: "Invalid Move", description: `You must play a ${leadingSuit} card.` });
            return prev;
        }

        const newHand = player.hand.filter(c => c.id !== card.id);
        const newTrick = { ...trick, cards: [...trick.cards, { playerId: player.id, card }] };
        if (!newTrick.leadingSuit) {
            newTrick.leadingSuit = card.suit;
        }
        
        const updatedPlayers = prev.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);
        
        const nextPlayerId = (prev.currentPlayerId + 1) % prev.playerCount;
        
        let newState = {...prev!, players: updatedPlayers, currentTrick: newTrick, currentPlayerId: nextPlayerId };
        
        if (newTrick.cards.length === prev.playerCount) {
            setIsProcessing(true);
            setTimeout(() => {
                setGameState(currentState => {
                    processTrick(currentState);
                    // This is where you would get the next state from processTrick and send to server
                    // onGameUpdate(processedState);
                    return currentState; // The state is set within processTrick
                });
            }, 1500);
        } else {
            // onGameUpdate(newState);
        }

        return newState;
    });
  }, [toast, localPlayerId]);

  const handleConfirmPartners = () => {
      if(!gameState || !selectedTrump || selectedPartners.length < getNumberOfPartners(gameState.playerCount)) {
          toast({ variant: "destructive", title: "Selection Incomplete", description: "Please select a trump suit and partner card(s)."});
          return;
      }

      const partnerCards = gameState.deck.filter(c => selectedPartners.includes(c.id));
      
      setGameState(prev => {
          if(!prev) return null;
          const newState = confirmPartners(prev, selectedTrump, partnerCards);
          // onGameUpdate(newState);
          return newState;
      });

      setShowPartnerDialog(false);
  }
  
  const resetGame = () => {
    // This would trigger a "play again" event on the server
    console.log("Resetting game");
  }

  if (!gameState || !me) return <div>Loading Game...</div>;

  const { players, playerCount, currentPlayerId } = gameState;
  const otherPlayers = players.filter(p => p.id !== localPlayerId);

  return (
      <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-background to-purple-100 p-4 font-body">
        {/* Game Info Header */}
        <AnimatePresence>
        {gameState.phase === 'playing' && gameState.highestBid && (
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm p-3 rounded-xl shadow-lg flex items-center gap-4 z-20 border"
            >
                <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-muted-foreground" />
                    <span className="font-bold text-primary">{gameState.highestBid.amount}</span>
                    <span className="text-muted-foreground">by {players.find(p => p.id === gameState.highestBid?.playerId)?.name}</span>
                </div>
                <div className="w-px h-6 bg-border mx-2"></div>
                {gameState.trumpSuit && (
                    <div className="flex items-center gap-2">
                        <span className="font-bold">Trump:</span>
                        <SuitSelectIcon suit={gameState.trumpSuit} />
                    </div>
                )}
            </motion.div>
        )}
        </AnimatePresence>

        {/* Other Players */}
        {otherPlayers.map((p, i) => (
          <motion.div 
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            initial={{opacity: 0}}
            animate={{ opacity: 1, ...playerPositions[i] }}
            transition={{duration: 0.5}}
          >
            <div className="flex flex-col items-center gap-2 w-48">
               <Badge variant={p.id === currentPlayerId ? 'destructive' : 'secondary'} className="px-3 py-1 text-sm transition-all shadow">
                  {p.name}
               </Badge>
               <Avatar className={cn("border-4 transition-all duration-500", p.id === currentPlayerId ? 'border-accent' : 'border-transparent', p.id === lastTrickWinner?.id ? 'border-yellow-400 scale-110' : '')}>
                  <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="relative h-12 flex items-center justify-center">
                  {p.hand.map((_, idx) => (
                      <div key={idx} className="absolute" style={{ transform: `translateX(${(idx - p.hand.length / 2) * 10}px) rotate(${(idx - p.hand.length/2) * 5}deg)`}}>
                        <CardUI className="!w-10 !h-14" />
                      </div>
                  ))}
              </div>
              <Badge variant="outline" className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500"/> {p.tricksWon} tricks
              </Badge>
            </div>
          </motion.div>
        ))}

        {/* Table Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
          <AnimatePresence>
          {gameState.phase === 'playing' && (
            <motion.div 
              key="trick-area"
              initial={{opacity: 0, scale: 0.8}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.8}}
              className="relative flex items-center justify-center w-80 h-48 bg-black/10 rounded-2xl border-2 border-dashed border-white/20 p-4"
            >
              <AnimatePresence>
              {gameState.currentTrick.cards.map(({card, playerId}, index) => (
                  <motion.div 
                    key={card.id} 
                    className="absolute" 
                    initial={{ opacity: 0, scale: 0.5, y: -20 }}
                    animate={{ 
                        opacity: 1, 
                        scale: 1, 
                        rotate: (index - gameState.currentTrick.cards.length / 2) * 8,
                        x: (index - gameState.currentTrick.cards.length / 2) * 40,
                    }}
                    exit={{ opacity: 0, scale: 0.5, y: 50, transition: { duration: 0.3 } }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20}}
                  >
                      <CardUI card={card} isFaceUp={true} className="!w-20 !h-28" />
                  </motion.div>
              ))}
              </AnimatePresence>
            </motion.div>
          )}
          </AnimatePresence>
          {(isProcessing && gameState.currentPlayerId !== localPlayerId) && (
              <div className="text-center p-4 bg-card/80 rounded-lg shadow-lg">
                  <p className="text-muted-foreground animate-pulse">Waiting for {players.find(p => p.id === currentPlayerId)?.name}...</p>
              </div>
          )}
           {gameState.phase === 'bidding' && gameState.currentPlayerId !== localPlayerId && (
                <div className="text-center p-4 bg-card/80 rounded-lg shadow-lg">
                    <p className="text-muted-foreground">Waiting for {players[currentPlayerId].name} to bid...</p>
                    {gameState.highestBid && <p>Current bid: <span className="font-bold text-primary">{gameState.highestBid.amount}</span> by {players[gameState.highestBid.playerId].name}</p>}
                </div>
            )}
        </div>

        {/* User's Hand & Area */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full flex flex-col items-center">
           {/* Bidding UI */}
          {gameState.phase === 'bidding' && currentPlayerId === localPlayerId && !isProcessing && (
              <motion.div initial={{y:50, opacity:0}} animate={{y:0, opacity:1}} className="bg-card p-4 rounded-t-lg shadow-lg flex items-center gap-4">
                  <h3 className="text-lg font-bold">Your Bid:</h3>
                  <Input type="number" value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))} step={5} className="w-32" />
                  <Button onClick={() => handlePlaceBid(bidAmount, localPlayerId)}>Place Bid</Button>
                  <Button variant="outline" onClick={() => handlePass(localPlayerId)}>Pass</Button>
              </motion.div>
          )}
          <div className="flex justify-center items-end p-4" style={{ minHeight: '220px' }}>
            <AnimatePresence>
            {me.hand.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ 
                    opacity: 1, 
                    y: 0, 
                    x: (i - me.hand.length / 2) * 40,
                    rotate: (i - me.hand.length / 2) * 4
                }}
                exit={{ opacity: 0, y: 100, x: (i - me.hand.length / 2) * 40, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25, delay: i * 0.05 }}
                style={{ zIndex: i }}
                className="absolute bottom-20"
              >
                <CardUI 
                  card={card} 
                  isFaceUp={true} 
                  isPlayable={gameState.phase === 'playing' && currentPlayerId === localPlayerId && !isProcessing} 
                  onClick={() => gameState.phase === 'playing' && currentPlayerId === localPlayerId && !isProcessing && handlePlayCard(card, localPlayerId)} 
                />
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
          <div className="bg-card/80 backdrop-blur-sm p-3 rounded-t-lg shadow-inner flex items-center gap-4 border-t border-x">
              <Avatar className={cn("border-4 transition-all duration-500", me.id === lastTrickWinner?.id ? 'border-yellow-400 scale-110' : 'border-transparent')}><AvatarFallback>{me.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <p className="font-bold text-lg">{me.name}</p>
              {me.isBidder && <Badge><Crown className="w-4 h-4 mr-1" />Bidder</Badge>}
              {me.isPartner && <Badge variant="secondary"><Users className="w-4 h-4 mr-1"/>Partner</Badge>}
              <Badge variant="outline" className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500"/> {me.tricksWon} tricks
              </Badge>
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
                <Select onValueChange={(v: Card['suit']) => setSelectedTrump(v)}>
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
                      setSelectedPartners(Array.from(new Set(newPartners)));
                  }}>
                      <SelectTrigger className="mb-2"><SelectValue placeholder={`Select partner card ${i+1}...`} /></SelectTrigger>
                      <SelectContent>
                      {gameState.deck
                          .filter(c => !me.hand.find(hc => hc.id === c.id))
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
              {gameState.phase === 'results' && gameState.team1Score > 0 && (
                  <AnimatePresence>
                      {(gameState.team1Score >= gameState.highestBid!.amount) && 
                          <Confetti width={windowSize.width} height={windowSize.height} recycle={false} />
                      }
                  </AnimatePresence>
              )}
            <DialogHeader>
              <DialogTitle>Round Over!</DialogTitle>
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
                              <p>Needed to block: {250 - gameState.highestBid.amount + 5}</p>
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
