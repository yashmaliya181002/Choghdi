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
    localPlayerId: number; // The ID of the person viewing the board
    onGameStateChange: (newState: GameState) => void;
};

export default function GameBoard({ initialGameState, localPlayerId, onGameStateChange }: GameBoardProps) {
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
  
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId)!;
  const localPlayer = gameState.players.find(p => p.id === localPlayerId)!;
  const bidder = gameState.players.find(p => p.id === gameState.highestBid?.playerId);
  
  const playerPositions = useMemo(() => {
    const positions: { [key: number]: { top?: string, left?: string, bottom?: string, right?: string, transform?: string } } = {};
    const playerCount = gameState.playerCount;
    
    // Find the visual index of the local player in the players array
    const localPlayerIndex = gameState.players.findIndex(p => p.id === localPlayerId);
  
    // Create a new array of players starting from the local player
    const orderedPlayers = [...gameState.players.slice(localPlayerIndex), ...gameState.players.slice(0, localPlayerIndex)];
  
    // Player 0 is always at the bottom
    positions[localPlayerId] = { bottom: '20px', left: '50%', transform: 'translateX(-50%)' };

    // Other players are arranged around the table
    const otherPlayers = orderedPlayers.filter(p => p.id !== localPlayerId);

    if (playerCount === 4) {
        if (otherPlayers[0]) positions[otherPlayers[0].id] = { top: `calc(50% - 250px)`, left: `20px`, transform: 'translateY(-50%) rotate(90deg)' }; // Left
        if (otherPlayers[1]) positions[otherPlayers[1].id] = { top: `20px`, left: `50%`, transform: 'translateX(-50%) rotate(180deg)' }; // Top
        if (otherPlayers[2]) positions[otherPlayers[2].id] = { top: `calc(50% - 250px)`, right: `20px`, transform: 'translateY(-50%) rotate(-90deg)' }; // Right
    } else {
        // Fallback for other player counts (semi-circle)
        const angleIncrement = Math.PI / (otherPlayers.length + 1);
        otherPlayers.forEach((player, index) => {
            const angle = angleIncrement * (index + 1);
            positions[player.id] = {
                top: `calc(50% - 300px * ${Math.sin(angle)})`,
                left: `calc(50% - 400px * ${Math.cos(angle)})`,
                transform: 'translate(-50%, -50%)'
            };
        });
    }

    return positions;
  }, [gameState.players, gameState.playerCount, localPlayerId]);


  useEffect(() => {
    // This effect would ideally be replaced by a real-time subscription (e.g., Firestore onSnapshot)
    // For now, we manually update the state when the prop changes.
    setGameState(initialGameState);

    if (initialGameState.phase === 'partner-selection' && initialGameState.currentPlayerId === localPlayerId) {
        setShowPartnerDialog(true);
    } else {
        setShowPartnerDialog(false);
    }
  }, [initialGameState, localPlayerId]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  const handlePlaceBid = (amount: number, playerId: number) => {
      const currentHighestBid = gameState.highestBid?.amount || 115;
      if (amount < currentHighestBid + 5) {
        toast({ variant: "destructive", title: "Invalid Bid", description: `Your bid must be at least ${currentHighestBid + 5}.`});
        return;
      }
      if (amount % 5 !== 0) {
        toast({ variant: "destructive", title: "Invalid Bid", description: `Your bid must be a multiple of 5.`});
        return;
      }

      const newBids = [...gameState.bids, { playerId: playerId, amount: amount }];
      const nextPlayerId = (playerId + 1) % gameState.playerCount;
      
      let updatedState: GameState = {
          ...gameState,
          bids: newBids,
          highestBid: { playerId: playerId, amount: amount },
          currentPlayerId: nextPlayerId,
      };

      if (newBids.length >= gameState.playerCount) {
          updatedState = finishBidding(updatedState);
      }
      onGameStateChange(updatedState);
  };

  const handlePass = (playerId: number) => {
        const newBids = [...gameState.bids, { playerId: playerId, amount: 0 }]; // 0 for pass
        const nextPlayerId = (playerId + 1) % gameState.playerCount;

        let updatedState: GameState = { ...gameState, bids: newBids, currentPlayerId: nextPlayerId };
        
        const passes = updatedState.bids.filter(b => b.amount === 0).length;
        const activeBidders = updatedState.playerCount - passes;
        
        if (activeBidders <= 1 && updatedState.bids.length >= updatedState.playerCount) {
            updatedState = finishBidding(updatedState);
        } else if (passes === updatedState.playerCount) {
             updatedState = finishBidding(updatedState);
        }
        onGameStateChange(updatedState);
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
     const bidderPlayer = currentState.players.find(p => p.id === currentState.highestBid!.playerId);
     if(bidderPlayer) bidderPlayer.isBidder = true;

     const finalState = { 
        ...currentState,
         phase: 'partner-selection',
         currentPlayerId: currentState.highestBid!.playerId,
     }
     
     if (finalState.currentPlayerId === localPlayerId) {
        setShowPartnerDialog(true);
     }
     
     toast({ title: "Partner Selection", description: `Waiting for ${bidderPlayer?.name} to select partners.`});
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
      
      const updatedState = { 
        ...gameState!, 
        phase: 'playing', 
        trumpSuit: selectedTrump, 
        partnerCards, 
        players: updatedPlayers 
      };

      onGameStateChange(updatedState);
      setShowPartnerDialog(false);
      setSelectedPartners([]);
      setSelectedTrump(null);
  }

  const handlePlayCard = (card: Card, playerId: number) => {
        if (!gameState || gameState.phase !== 'playing' || playerId !== gameState.currentPlayerId) return;

        const player = gameState.players.find(p => p.id === playerId);
        if (!player) return;

        const trick = gameState.currentTrick;
        const leadingSuit = trick.leadingSuit;

        if (leadingSuit && player.hand.some(c => c.suit === leadingSuit) && card.suit !== leadingSuit) {
            toast({ variant: "destructive", title: "Invalid Move", description: `You must play a ${leadingSuit} card.` });
            return;
        }

        const newHand = player.hand.filter(c => c.id !== card.id);
        const newTrick = { ...trick, cards: [...trick.cards, { playerId: player.id, card }] };
        if (!newTrick.leadingSuit) {
            newTrick.leadingSuit = card.suit;
        }
        
        const updatedPlayers = gameState.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);
        
        const nextPlayerId = (gameState.currentPlayerId + 1) % gameState.playerCount;
        
        let newState: GameState = {...gameState, players: updatedPlayers, currentTrick: newTrick, currentPlayerId: nextPlayerId };
        
        if (newTrick.cards.length === gameState.playerCount) {
            setIsProcessing(true);
            setTimeout(() => {
                const postTrickState = processTrick(newState);
                onGameStateChange(postTrickState);
                setIsProcessing(false);
            }, 2000);
        }

        onGameStateChange(newState);
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
          ? {...p, collectedCards: [...p.collectedCards, ...collectedCards], tricksWon: (p.tricksWon || 0) + 1 } 
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
    if(!gameState) return;
    const deck = createDeck(gameState.playerCount);
    const players = gameState.players.map(p => ({
        ...p,
        hand: [],
        isBidder: false,
        isPartner: false,
        collectedCards: [],
        tricksWon: 0,
    }));
    const dealtPlayers = dealCards(deck, players);
    const newGameState = {
        ...gameState,
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
    onGameStateChange(newGameState);
    setShowResults(false);
  }

  if (!gameState || !currentPlayer || !localPlayer) return <div>Loading Game...</div>;

  const { players, playerCount, currentPlayerId } = gameState;
  
  const renderPlayerArea = (player: Player) => {
    const isLocalPlayer = player.id === localPlayerId;
    const isCurrentTurn = player.id === currentPlayerId;

    return (
     <div className="flex flex-col items-center gap-2 relative">
        {!isLocalPlayer && (
             <div className="relative h-16 flex items-center justify-center -mb-2">
                {player.hand.map((_, idx) => (
                    <div key={idx} className="absolute" style={{ 
                        transform: `translateX(${(idx - player.hand.length / 2) * 8}px)`,
                        zIndex: idx,
                    }}>
                    <CardUI className="!w-10 !h-14" />
                    </div>
                ))}
            </div>
        )}

        <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-card/70 backdrop-blur-sm border shadow-lg min-w-[120px] text-center">
            <Avatar className={cn("border-4 transition-all duration-500", isCurrentTurn ? 'border-accent' : 'border-transparent', player.id === lastTrickWinner?.id ? 'border-yellow-400 scale-110' : '')}>
                <AvatarFallback>{player.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Badge variant={isCurrentTurn ? 'destructive' : 'secondary'} className="px-3 py-1 text-sm transition-all shadow-md">
               {player.name}
            </Badge>
            <div className="flex gap-2 items-center">
                {player.isBidder && <Badge title="Bidder"><Crown className="w-4 h-4" /> </Badge>}
                {player.isPartner && <Badge variant="secondary" title="Partner"><Users className="w-4 h-4"/></Badge>}
                <Badge variant="outline" className="flex items-center gap-1.5 px-2">
                    <Trophy className="w-3 h-3 text-yellow-500"/> {player.tricksWon || 0}
                </Badge>
            </div>
        </div>
     </div>
    )
  };

  const localPlayerHand = localPlayer.hand;

  return (
      <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-background to-purple-100 p-4 font-body">
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

        {players.map((p) => (
          <motion.div 
            key={p.id}
            className="absolute z-10"
            initial={{opacity: 0}}
            animate={{ opacity: 1, ...(playerPositions[p.id] || {}) }}
            transition={{duration: 0.5}}
          >
            {renderPlayerArea(p)}
          </motion.div>
        ))}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="relative rounded-full bg-green-800/90 shadow-2xl border-[16px] border-amber-800" style={{width: '400px', height: '400px'}}>
                <div className="absolute inset-0 rounded-full bg-green-900/50" />

                 <AnimatePresence>
                 {gameState.phase === 'playing' && !showLastTrick && (
                    <motion.div 
                    key="trick-area"
                    initial={{opacity: 0, scale: 0.8}}
                    animate={{opacity: 1, scale: 1}}
                    exit={{opacity: 0, scale: 0.8}}
                    className="absolute inset-0 flex items-center justify-center"
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
                                rotate: (index * 360/playerCount) + 15,
                                x: Math.cos((index / playerCount) * 2 * Math.PI - Math.PI / 2) * 60,
                                y: Math.sin((index / playerCount) * 2 * Math.PI - Math.PI / 2) * 60,
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/20 rounded-full">
                        <p className="text-lg font-semibold text-white">Bidding Phase</p>
                        <p className="text-white/80 animate-pulse">Waiting for {currentPlayer.name} to bid...</p>
                        {gameState.highestBid && <p className="text-white">Current bid: <span className="font-bold text-yellow-300">{gameState.highestBid.amount}</span> by {players.find(p => p.id === gameState.highestBid.playerId)?.name}</p>}
                    </div>
                )}
            </div>
        </div>

        {/* Current Player's Hand */}
        <div className="absolute bottom-[80px] left-0 right-0 flex justify-center items-end p-4" style={{ height: '180px' }}>
            <AnimatePresence>
            {localPlayerHand.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ 
                    opacity: 1, 
                    y: 0, 
                    x: (i - localPlayerHand.length / 2) * 40,
                    rotate: (i - localPlayerHand.length / 2) * 4
                }}
                exit={{ opacity: 0, y: 100, x: (i - localPlayerHand.length / 2) * 40, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25, delay: i * 0.05 }}
                style={{ zIndex: i }}
                className="absolute"
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
        
        <AnimatePresence>
        {currentPlayerId === localPlayerId && !isProcessing && (
            <motion.div 
                key="action-area"
                initial={{y:100, opacity:0}} animate={{y:0, opacity:1}} exit={{y:100, opacity:0}} 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card p-4 rounded-lg shadow-lg flex items-center gap-4 border z-30"
            >
            {gameState.phase === 'bidding' && (
                <>
                    <h3 className="text-lg font-bold">Your Bid:</h3>
                    <Input type="number" value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))} step={5} className="w-32" />
                    <Button onClick={() => handlePlaceBid(bidAmount, localPlayerId)}>Place Bid</Button>
                    <Button variant="outline" onClick={() => handlePass(localPlayerId)}>Pass</Button>
                </>
            )}
            {/* The play card action is handled by clicking the card itself */}
            </motion.div>
        )}
        </AnimatePresence>
        
        <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Trump and Partners</DialogTitle>
              <DialogDescription>
                You won with {gameState.highestBid?.amount}. Time to choose!
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
                          .filter(c => {
                              const bidderHand = bidder?.hand;
                              if (!bidderHand) return true;
                              return !bidderHand.find(hc => hc.id === c.id);
                          })
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
              <Button onClick={handleConfirmPartners}>Confirm and Start Game</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResults} onOpenChange={setShowResults}>
          <DialogContent>
              {gameState.phase === 'results' && gameState.highestBid && gameState.team1Score > 0 && (
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
