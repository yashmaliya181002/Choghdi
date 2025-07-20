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
// AI flows are removed for local multiplayer testing
// import { decideBid } from '@/ai/flows/bidding-flow';
// import { decideCardPlay } from '@/ai/flows/play-card-flow';


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
};

export default function GameBoard({ initialGameState, localPlayerId }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [bidAmount, setBidAmount] = useState(120);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [selectedTrump, setSelectedTrump] = useState<Card['suit'] | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTrickWinner, setLastTrickWinner] = useState<Player | null>(null);
  const [showLastTrick, setShowLastTrick] = useState(false);

  const { toast } = useToast();
  
  const me = gameState.players.find(p => p.id === localPlayerId)!;
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId)!;

  const playerPositions = useMemo(() => {
    if (!gameState) return [];
    
    // Arrange players around the 'me' player
    const myIdx = gameState.players.findIndex(p => p.id === localPlayerId);
    const reorderedPlayers = [...gameState.players.slice(myIdx), ...gameState.players.slice(0, myIdx)];
    const otherPlayers = reorderedPlayers.filter(p => p.id !== localPlayerId);

    const positions: {[key: number]: { top: string, left: string }} = {};
    const radiusX = Math.min(windowSize.width * 0.4, 450);
    const radiusY = Math.min(windowSize.height * 0.35, 280);
    const centerX = windowSize.width / 2;
    const centerY = windowSize.height / 2 - 50;
    
    // Place other players in a circle
    const angleStep = Math.PI * 2 / (gameState.playerCount);

    reorderedPlayers.forEach((player, index) => {
        if(player.id === localPlayerId) return;

        const angle = -Math.PI / 2 + index * angleStep;
        positions[player.id] = {
            top: `${centerY + radiusY * Math.sin(angle)}px`,
            left: `${centerX + radiusX * Math.cos(angle)}px`,
        };
    });

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
  
  const handlePlaceBid = (amount: number, playerId: number) => {
    setGameState(prev => {
      if (!prev || prev.phase !== 'bidding') return prev;
      
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
      return updatedState;
    });
  };

  const handlePass = (playerId: number) => {
    setGameState(prev => {
        if (!prev || prev.phase !== 'bidding') return prev;
        const newBids = [...prev.bids, { playerId: playerId, amount: 0 }]; // 0 for pass
        const nextPlayerId = (playerId + 1) % prev.playerCount;

        let updatedState = { ...prev, bids: newBids, currentPlayerId: nextPlayerId };
        
        const passes = updatedState.bids.filter(b => b.amount === 0).length;
        const activeBidders = updatedState.playerCount - passes;
        
        if (activeBidders <= 1 && updatedState.bids.length >= updatedState.playerCount) {
            updatedState = finishBidding(updatedState);
        } else if (passes === updatedState.playerCount) {
             updatedState = finishBidding(updatedState);
        }
        return updatedState;
    });
  };

  const finishBidding = (currentState: GameState): GameState => {
    if(!currentState.highestBid){
        toast({ title: "Everyone Passed!", description: "Restarting round." });
        // In a real app you might redeal, here we just reset the phase
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
     
     // The bidder is now the current player, check if it's "me" to show dialog
     if (finalState.currentPlayerId === localPlayerId) {
        setShowPartnerDialog(true);
     } else {
        setShowPartnerDialog(true); // Now everyone can see who is selecting
     }
     
     toast({ title: "Partner Selection", description: `Waiting for ${bidder?.name} to select partners.`});
     return finalState;
  };

  const handleConfirmPartners = () => {
      if(!gameState || !selectedTrump || selectedPartners.length < getNumberOfPartners(gameState.playerCount)) {
          toast({ variant: "destructive", title: "Selection Incomplete", description: "Please select a trump suit and partner card(s)."});
          return;
      }
      
      const partnerCards = gameState.deck.filter(c => selectedPartners.includes(c.id));
      
      const updatedPlayers = gameState.players.map(p => {
          if (p.hand.some(cardInHand => partnerCards.some(pc => pc.id === cardInHand.id))) {
              return { ...p, isPartner: true };
          }
          return p;
      });

      toast({ title: "Partners Selected!", description: `Trump is ${selectedTrump}. The game begins!` });
      
      setGameState(prev => ({ 
        ...prev!, 
        phase: 'playing', 
        trumpSuit: selectedTrump, 
        partnerCards, 
        players: updatedPlayers 
      }));

      setShowPartnerDialog(false);
  }

  const handlePlayCard = (card: Card, playerId: number) => {
    setGameState(prev => {
        if (!prev || prev.phase !== 'playing' || playerId !== prev.currentPlayerId) return prev;

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
                    const postTrickState = processTrick(currentState);
                    return postTrickState;
                });
            }, 2000);
        }

        return newState;
    });
  };

  const processTrick = (currentState: GameState): GameState => {
      if (!currentState || !currentState.trumpSuit || currentState.currentTrick.cards.length !== currentState.playerCount) return currentState;
      
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
      
      const updatedPlayers = currentState.players.map(p => 
          p.id === winner.playerId 
          ? {...p, collectedCards: [...p.collectedCards, ...collectedCards], tricksWon: p.tricksWon + 1 } 
          : p
      );
      
      const tricksPlayed = currentState.tricksPlayed + 1;
      const maxTricks = Math.floor(currentState.deck.length / currentState.playerCount);

      if (tricksPlayed === maxTricks) {
          const bidderTeam = updatedPlayers.filter(p => p.isBidder || p.isPartner);
          const opponentTeam = updatedPlayers.filter(p => !p.isBidder && !p.isPartner);
          
          const team1Score = bidderTeam.reduce((acc, p) => acc + p.collectedCards.reduce((sum, card) => sum + getCardPoints(card), 0), 0);
          const team2Score = opponentTeam.reduce((acc, p) => acc + p.collectedCards.reduce((sum, card) => sum + getCardPoints(card), 0), 0);
          
          setTimeout(() => setShowResults(true), 1500);

          return {
            ...currentState,
            players: updatedPlayers,
            currentTrick: { cards: [], leadingSuit: null },
            currentPlayerId: winner.playerId,
            tricksPlayed: tricksPlayed,
            phase: 'results',
            team1Score,
            team2Score
          };
      }

      setShowLastTrick(true);
      setTimeout(() => setShowLastTrick(false), 1800);
      setIsProcessing(false);

      // Return to playing phase for next trick
      return {
        ...currentState,
        players: updatedPlayers,
        currentTrick: { cards: [], leadingSuit: null },
        currentPlayerId: winner.playerId,
        tricksPlayed: tricksPlayed,
      };
  }
  
  const resetGame = () => {
    // This would trigger a "play again" event on the server
    // For now, it just resets the local state for a new round
    setGameState(prev => {
        if(!prev) return null;
        const deck = createDeck(prev.playerCount);
        const players = prev.players.map(p => ({
            ...p,
            hand: [],
            isBidder: false,
            isPartner: false,
            collectedCards: [],
            tricksWon: 0,
        }));
        const dealtPlayers = dealCards(deck, players);
        return {
            ...prev,
            phase: 'bidding',
            players: dealtPlayers,
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
        }
    });
    setShowResults(false);
  }

  if (!gameState || !me) return <div>Loading Game...</div>;

  const { players, playerCount, currentPlayerId } = gameState;
  const otherPlayers = players.filter(p => p.id !== localPlayerId);

  const renderPlayerArea = (player: Player) => (
     <div className="flex flex-col items-center gap-2">
         {player.id !== localPlayerId && (
            <div className="relative h-16 flex items-center justify-center -mb-2">
                {player.hand.map((_, idx) => (
                    <div key={idx} className="absolute" style={{ 
                        transform: `translateX(${(idx - player.hand.length / 2) * 8}px) rotate(${(idx - player.hand.length/2) * 5}deg)`,
                        zIndex: idx,
                    }}>
                    <CardUI className="!w-10 !h-14" />
                    </div>
                ))}
            </div>
         )}
        <Avatar className={cn("border-4 transition-all duration-500", player.id === currentPlayerId ? 'border-accent' : 'border-transparent', player.id === lastTrickWinner?.id ? 'border-yellow-400 scale-110' : '')}>
            <AvatarFallback>{player.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Badge variant={player.id === currentPlayerId ? 'destructive' : 'secondary'} className="px-3 py-1 text-sm transition-all shadow-md">
           {player.name}
        </Badge>
        <div className="flex gap-2">
            {player.isBidder && <Badge><Crown className="w-3 h-3" /> </Badge>}
            {player.isPartner && <Badge variant="secondary"><Users className="w-3 h-3"/></Badge>}
            <Badge variant="outline" className="flex items-center gap-1">
                <Trophy className="w-3 h-3 text-yellow-500"/> {player.tricksWon}
            </Badge>
        </div>
     </div>
  );

  return (
      <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-background to-purple-100 p-4 font-body">
        {/* Game Info Header */}
        <AnimatePresence>
        {(gameState.phase === 'playing' || gameState.phase === 'results') && gameState.highestBid && (
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
        {otherPlayers.map((p) => (
          <motion.div 
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            initial={{opacity: 0}}
            animate={{ opacity: 1, ...(playerPositions[p.id] || {}) }}
            transition={{duration: 0.5}}
          >
            {renderPlayerArea(p)}
          </motion.div>
        ))}

        {/* Table Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
          <AnimatePresence>
          {gameState.phase === 'playing' && !showLastTrick && (
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

           {gameState.phase === 'bidding' && (
                <div className="text-center p-4 bg-card/80 rounded-lg shadow-lg">
                    <p className="text-muted-foreground animate-pulse">Waiting for {players[currentPlayerId].name} to bid...</p>
                    {gameState.highestBid && <p>Current bid: <span className="font-bold text-primary">{gameState.highestBid.amount}</span> by {players[gameState.highestBid.playerId].name}</p>}
                </div>
            )}
        </div>

        {/* User's Hand & Area */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full flex flex-col items-center">
           {/* Bidding UI for current player */}
          {gameState.phase === 'bidding' && !isProcessing && (
              <motion.div initial={{y:50, opacity:0}} animate={{y:0, opacity:1}} className="bg-card p-4 rounded-t-lg shadow-lg flex items-center gap-4">
                  <h3 className="text-lg font-bold">{currentPlayer.name}'s Bid:</h3>
                  <Input type="number" value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))} step={5} className="w-32" />
                  <Button onClick={() => handlePlaceBid(bidAmount, currentPlayerId)}>Place Bid</Button>
                  <Button variant="outline" onClick={() => handlePass(currentPlayerId)}>Pass</Button>
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
                  isPlayable={gameState.phase === 'playing' && currentPlayerId === me.id && !isProcessing}
                  onClick={() => gameState.phase === 'playing' && !isProcessing && handlePlayCard(card, me.id)} 
                />
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
          <div className="bg-card/80 backdrop-blur-sm p-3 rounded-t-lg shadow-inner flex items-center gap-4 border-t border-x">
              {renderPlayerArea(me)}
          </div>
        </div>
        
        {/* Partner Selection Dialog */}
        <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Trump and Partners</DialogTitle>
              <DialogDescription>
                {players.find(p => p.id === gameState.highestBid?.playerId)?.name} won with {gameState.highestBid?.amount}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="font-bold">Trump Suit</Label>
                <Select onValueChange={(v: Card['suit']) => setSelectedTrump(v)} disabled={currentPlayerId !== gameState.highestBid?.playerId}>
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
                  }} disabled={currentPlayerId !== gameState.highestBid?.playerId}>
                      <SelectTrigger className="mb-2"><SelectValue placeholder={`Select partner card ${i+1}...`} /></SelectTrigger>
                      <SelectContent>
                      {gameState.deck
                          .filter(c => !me.hand.find(hc => hc.id === c.id))
                          .filter(c => !selectedPartners.includes(c.id) || selectedPartners[i] === c.id)
                          .sort((a,b) => (a.suit + a.rank).localeCompare(b.suit + b.rank))
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
              <Button onClick={handleConfirmPartners} disabled={currentPlayerId !== gameState.highestBid?.playerId}>Confirm and Start Game</Button>
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
