
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type GameState, type Player, type Card, getNumberOfPartners, getCardPoints, Rank } from '@/lib/game';
import { CardUI } from './CardUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SpadeIcon, HeartIcon, ClubIcon, DiamondIcon } from './SuitIcons';
import { Crown, Users, Trophy, Info } from 'lucide-react';
import Confetti from 'react-confetti';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SuitSelectIcon = ({ suit }: { suit: Card['suit'] }) => {
    const commonClass = "w-5 h-5 mr-2";
    switch(suit) {
        case 'spades': return <SpadeIcon className={commonClass} />;
        case 'hearts': return <HeartIcon className={cn("text-red-600", commonClass)} />;
        case 'clubs': return <ClubIcon className={commonClass} />;
        case 'diamonds': return <DiamondIcon className={cn("text-red-600", commonClass)} />;
    }
}

type GameBoardProps = {
    initialGameState: GameState;
    localPlayerId: number;
    isHost: boolean;
    broadcastGameState?: (newState: GameState) => void;
};

export default function GameBoard({ initialGameState, localPlayerId, isHost, broadcastGameState }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [bidAmount, setBidAmount] = useState(120);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [selectedTrump, setSelectedTrump] = useState<Card['suit'] | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTrickWinnerId, setLastTrickWinnerId] = useState<number | null>(null);

  const { toast } = useToast();
  
  // This effect ensures that state updates from the hook/prop are reflected locally
  useEffect(() => {
    setGameState(initialGameState);
  }, [initialGameState]);

  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId)!;
  const localPlayer = gameState.players.find(p => p.id === localPlayerId)!;
  const bidder = gameState.players.find(p => p.id === gameState.highestBid?.playerId);
  
  const playerPositions = useMemo(() => {
    const positions: { [key: number]: { top?: string, left?: string, bottom?: string, right?: string, transform: string } } = {};
    const playerCount = gameState.players.length;
    if (playerCount === 0 || typeof window === 'undefined') return {};

    const localPlayerIndex = gameState.players.findIndex(p => p.id === localPlayerId);
    if (localPlayerIndex === -1) return {};

    // Use a smaller radius for more players to keep them on screen
    const baseRadiusX = window.innerWidth < 768 ? 0.35 : 0.4;
    const baseRadiusY = window.innerHeight < 768 ? 0.3 : 0.35;
    const radiusMultiplier = Math.max(0.7, 1 - (playerCount - 4) * 0.05);

    const radiusX = window.innerWidth * baseRadiusX * radiusMultiplier;
    const radiusY = window.innerHeight * baseRadiusY * radiusMultiplier;

    gameState.players.forEach((player, i) => {
        const relativeIndex = (i - localPlayerIndex + playerCount) % playerCount;
        
        if (relativeIndex === 0) { // Local player
            positions[player.id] = {
                bottom: `5%`,
                left: `50%`,
                transform: 'translateX(-50%)'
            }
        } else {
             // Distribute other players in the top semi-circle
            const angle = Math.PI + (relativeIndex / (playerCount)) * Math.PI;
            const x = 50 + (radiusX / window.innerWidth * 100) * Math.cos(angle);
            const y = 50 + (radiusY / window.innerHeight * 100) * Math.sin(angle) * 1.5; // Use more vertical space
            positions[player.id] = {
                top: `${y}%`,
                left: `${x}%`,
                transform: 'translate(-50%, -50%)'
            };
        }
    });

    return positions;
  }, [gameState.players, localPlayerId, windowSize.width, windowSize.height]);


  const updateAndBroadcastState = (newState: GameState) => {
    if (isHost && broadcastGameState) {
        broadcastGameState(newState);
    } else {
        // Peers don't broadcast, the host does.
        // For now, we update locally for UI responsiveness.
        setGameState(newState);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
     if (gameState.phase === 'partner-selection' && gameState.highestBid?.playerId === localPlayerId) {
        setShowPartnerDialog(true);
    } else {
        setShowPartnerDialog(false);
    }
  }, [gameState.phase, gameState.highestBid?.playerId, localPlayerId]);
  
  const handlePlaceBid = async (amount: number) => {
      if (isProcessing || !isHost) return;
      setIsProcessing(true);

      const currentHighestBid = gameState.highestBid?.amount || 115;
      if (amount < currentHighestBid + 5) {
        toast({ variant: "destructive", title: "Invalid Bid", description: `Your bid must be at least ${currentHighestBid + 5}.`});
        setIsProcessing(false);
        return;
      }
      if (amount % 5 !== 0) {
        toast({ variant: "destructive", title: "Invalid Bid", description: `Your bid must be a multiple of 5.`});
        setIsProcessing(false);
        return;
      }

      let updatedState: GameState = JSON.parse(JSON.stringify(gameState));
      const playerId = localPlayerId;

      updatedState.bids.push({ playerId: playerId, amount: amount });
      updatedState.highestBid = { playerId: playerId, amount: amount };
      updatedState.turnHistory.push(`${localPlayer.name} bids ${amount}`);
      
      const passedPlayerIds = new Set(updatedState.bids.filter(b => b.amount === 0).map(b => b.playerId));
      
      let nextPlayerId = (playerId + 1) % updatedState.playerCount;
      while(passedPlayerIds.has(nextPlayerId) && nextPlayerId !== updatedState.highestBid.playerId){
          nextPlayerId = (nextPlayerId + 1) % updatedState.playerCount;
      }
      updatedState.currentPlayerId = nextPlayerId;

      const activeBidders = updatedState.players.filter(p => !passedPlayerIds.has(p.id)).length;
      
      if (activeBidders <= 1) {
          updatedState = finishBidding(updatedState);
      }
      
      updateAndBroadcastState(updatedState);
      setIsProcessing(false);
  };

  const handlePass = async () => {
        if (isProcessing || !isHost) return;
        setIsProcessing(true);
        let updatedState: GameState = JSON.parse(JSON.stringify(gameState));
        const playerId = localPlayerId;

        updatedState.bids.push({ playerId: playerId, amount: 0 }); // 0 for pass
        updatedState.turnHistory.push(`${localPlayer.name} passes.`);
        
        const passedPlayerIds = new Set(updatedState.bids.filter(b => b.amount === 0).map(b => b.playerId));
        const activeBidders = updatedState.players.filter(p => !passedPlayerIds.has(p.id)).length;

        if (activeBidders <= 1 && updatedState.highestBid) {
            updatedState = finishBidding(updatedState);
        } else if (activeBidders === 0 && !updatedState.highestBid) { // Everyone passed
            updatedState = finishBidding(updatedState);
        } else {
            let nextPlayerId = (playerId + 1) % updatedState.playerCount;
            while(passedPlayerIds.has(nextPlayerId)){
              nextPlayerId = (nextPlayerId + 1) % updatedState.playerCount;
            }
            updatedState.currentPlayerId = nextPlayerId;
        }

        updateAndBroadcastState(updatedState);
        setIsProcessing(false);
  };

  const finishBidding = (currentState: GameState): GameState => {
    if(!currentState.highestBid){
        toast({ title: "Everyone Passed!", description: "Restarting round." });
        currentState.phase = 'results';
        return currentState;
     }
     const bidderPlayer = currentState.players.find(p => p.id === currentState.highestBid!.playerId);
     if(bidderPlayer) bidderPlayer.isBidder = true;

     currentState.phase = 'partner-selection';
     currentState.currentPlayerId = currentState.highestBid!.playerId;
     
     return currentState;
  };

  const handleConfirmPartners = async () => {
      if (isProcessing || !isHost) return;
      if(!gameState || !selectedTrump || selectedPartners.length < getNumberOfPartners(gameState.playerCount)) {
          toast({ variant: "destructive", title: "Selection Incomplete", description: "Please select a trump suit and partner card(s)."});
          return;
      }
      setIsProcessing(true);
      
      let updatedState: GameState = JSON.parse(JSON.stringify(gameState));
      
      const partnerCards = updatedState.deck.filter(c => selectedPartners.includes(c.id));
      
      updatedState.players.forEach(p => {
          if (p.hand.some(cardInHand => partnerCards.some(pc => pc.id === cardInHand.id))) {
              p.isPartner = true;
          }
      });
      
      updatedState.phase = 'playing';
      updatedState.trumpSuit = selectedTrump;
      updatedState.partnerCards = partnerCards;
      updatedState.turnHistory.push(`${bidder?.name} chose ${selectedTrump} as trump.`);
      
      updateAndBroadcastState(updatedState);
      
      setShowPartnerDialog(false);
      setSelectedPartners([]);
      setSelectedTrump(null);
      setIsProcessing(false);
  }

  const handlePlayCard = async (card: Card) => {
        if (isProcessing || !isHost) return;
        if (!gameState || gameState.phase !== 'playing' || localPlayerId !== gameState.currentPlayerId) return;

        const trick = gameState.currentTrick;
        const leadingSuit = trick.leadingSuit;

        if (leadingSuit && localPlayer.hand.some(c => c.suit === leadingSuit) && card.suit !== leadingSuit) {
            toast({ variant: "destructive", title: "Invalid Move", description: `You must play a ${leadingSuit} card.` });
            return;
        }

        setIsProcessing(true);
        let newState: GameState = JSON.parse(JSON.stringify(gameState));

        const player = newState.players.find(p => p.id === localPlayerId)!;

        player.hand = player.hand.filter(c => c.id !== card.id);
        
        newState.currentTrick.cards.push({ playerId: player.id, card });
        if (!newState.currentTrick.leadingSuit) {
            newState.currentTrick.leadingSuit = card.suit;
        }
        
        newState.currentPlayerId = (newState.currentPlayerId + 1) % newState.playerCount;
        
        if (newState.currentTrick.cards.length === newState.playerCount) {
            // Delay processing to allow players to see the cards
            setTimeout(() => {
                let postTrickState = processTrick(newState);
                updateAndBroadcastState(postTrickState);
                setIsProcessing(false);
            }, 2000);
        } else {
             updateAndBroadcastState(newState);
             setIsProcessing(false);
        }
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
      setLastTrickWinnerId(winningPlayer.id);
      setTimeout(() => setLastTrickWinnerId(null), 2000);

      const collectedCards = trick.cards.map((c: any) => c.card);
      
      const winningPlayerInState = currentState.players.find(p => p.id === winner.playerId)!;
      winningPlayerInState.collectedCards.push(...collectedCards);
      winningPlayerInState.tricksWon = (winningPlayerInState.tricksWon || 0) + 1;
      
      currentState.tricksPlayed += 1;
      const maxTricks = Math.floor(currentState.deck.length / currentState.playerCount);

      if (currentState.tricksPlayed === maxTricks) {
          const bidderTeam = currentState.players.filter(p => p.isBidder || p.isPartner);
          const opponentTeam = currentState.players.filter(p => !p.isBidder && !p.isPartner);
          
          const team1Score = bidderTeam.reduce((acc, p) => acc + p.collectedCards.reduce((sum, card) => sum + getCardPoints(card), 0), 0);
          const team2Score = opponentTeam.reduce((acc, p) => acc + p.collectedCards.reduce((sum, card) => sum + getCardPoints(card), 0), 0);
          
          setTimeout(() => setShowResults(true), 1500);

          currentState.phase = 'results';
          currentState.team1Score = team1Score;
          currentState.team2Score = team2Score;
      }

      currentState.currentTrick = { cards: [], leadingSuit: null };
      currentState.currentPlayerId = winner.playerId;

      return currentState;
  }
  
  const resetGame = () => {
    // This is more complex now. Only the host can reset.
    // A proper implementation would send a "reset_game" message.
    // For now, this is disabled as it would only work for the host.
    toast({ title: "Game Reset", description: "Only the host can start a new game." });
  }

  if (!gameState || !currentPlayer || !localPlayer) return <div>Loading Game...</div>;

  const { players, playerCount, currentPlayerId } = gameState;
  
  const renderPlayerArea = (player: Player) => {
    const isLocalPlayer = player.id === localPlayerId;
    const isCurrentTurn = player.id === currentPlayerId;

    if (isLocalPlayer) return null; // We render the local player's hand separately

    return (
     <div className="flex flex-col items-center gap-2 relative">
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

        <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-card/70 backdrop-blur-sm border shadow-lg min-w-[120px] text-center">
            <Avatar className={cn("border-4 transition-all duration-500", isCurrentTurn ? 'border-accent' : 'border-transparent', player.id === lastTrickWinnerId ? 'border-yellow-400 scale-110' : '')}>
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
    );
  };

  const localPlayerHand = localPlayer.hand;

  return (
      <div className="relative w-full h-screen overflow-hidden game-background p-4 font-body">
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

        {/* The Table */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div 
                className="relative rounded-full bg-green-800 shadow-2xl flex items-center justify-center" 
                style={{
                    width: 'clamp(300px, 40vw, 550px)', 
                    aspectRatio: '1 / 1',
                    background: 'radial-gradient(circle, hsl(140 70% 25%) 0%, hsl(140 70% 20%) 100%)',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.3)'
                }}
            >
                {/* Wooden border */}
                <div 
                    className="absolute -inset-4 rounded-full"
                    style={{
                        background: `
                            repeating-radial-gradient(circle at 50% 50%, transparent, transparent 10px, rgba(0,0,0,.2) 10px, rgba(0,0,0,.2) 20px),
                            url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzkyNjY0MSI+PC9yZWN0PjxwYXRoIGQ9Ik0gMCwxMCBIIDEwMCBNIDAsMzAgSCAxMDAgTSAwLDUwIEggMTAwIE0gMCw3MCBIIDEwMCBNIDAsOTAgSCAxMDAiIHN0cm9rZT0iIzgwNTMyRiIgc3Ryb2tlLXdpZHRoPSIzIj48L3BhdGg+PHBhdGggZD0iTSA1MCwwIFYgMTAwIiBzdHJva2U9IiM4MDUzMkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLW9wYWNpdHk9IjAuNSI+PC9wYXRoPjwvc3ZnPg==')`,
                        backgroundSize: 'auto, 100px 100px',
                        boxShadow: 'inset 0 0 15px #54371e, 0 0 10px #54371e, 0 5px 15px rgba(0,0,0,0.5)',
                        zIndex: -1
                    }}
                ></div>

                 <AnimatePresence>
                 {gameState.phase === 'playing' && (
                    <motion.div 
                        key="trick-area"
                        initial={{opacity: 0, scale: 0.8}}
                        animate={{opacity: 1, scale: 1}}
                        exit={{opacity: 0, scale: 0.8}}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                    <AnimatePresence>
                    {gameState.currentTrick.cards.map(({card, playerId}) => {
                       const playerIndex = players.findIndex(p => p.id === playerId);
                       const localPlayerIndexOnServer = gameState.players.findIndex(p => p.id === localPlayerId);
                       const angle = (((playerIndex - localPlayerIndexOnServer + playerCount) % playerCount) / playerCount) * 2 * Math.PI - (Math.PI / 2);

                        return (
                        <motion.div 
                            key={card.id} 
                            className="absolute" 
                            initial={{ opacity: 0, scale: 0.5, y: -20 }}
                            animate={{ 
                                opacity: 1, 
                                scale: 1, 
                                x: Math.cos(angle) * 80,
                                y: Math.sin(angle) * 80,
                            }}
                            exit={{ opacity: 0, scale: 0.5, y: 50, transition: { duration: 0.3 } }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20}}
                        >
                            <CardUI card={card} isFaceUp={true} className="!w-20 !h-28" />
                        </motion.div>
                        )
                    })}
                    </AnimatePresence>
                    </motion.div>
                )}
                </AnimatePresence>

                 <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/20 rounded-full pointer-events-none">
                     <AnimatePresence mode="wait">
                         <motion.p 
                             key={`${gameState.currentPlayerId}-${gameState.phase}`}
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: -10 }}
                             transition={{ duration: 0.3 }}
                             className="text-lg font-semibold text-white drop-shadow-md"
                         >
                            {currentPlayerId === localPlayerId ? `Your turn to ${gameState.phase.replace('-', ' ')}` : `Waiting for ${currentPlayer.name}...`}
                         </motion.p>
                     </AnimatePresence>
                     {gameState.phase === 'bidding' && gameState.highestBid && <p className="text-white mt-1">Current bid: <span className="font-bold text-yellow-300">{gameState.highestBid.amount}</span> by {players.find(p => p.id === gameState.highestBid?.playerId)?.name}</p>}
                 </div>
            </div>
        </div>

        {/* Local Player Area at bottom */}
         <div className="absolute" style={playerPositions[localPlayerId]}>
             <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-card/70 backdrop-blur-sm border shadow-lg min-w-[120px] text-center">
                <Avatar className={cn("border-4 transition-all duration-500", currentPlayerId === localPlayerId ? 'border-accent' : 'border-transparent', localPlayerId === lastTrickWinnerId ? 'border-yellow-400 scale-110' : '')}>
                    <AvatarFallback>{localPlayer.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Badge variant={currentPlayerId === localPlayerId ? 'destructive' : 'secondary'} className="px-3 py-1 text-sm transition-all shadow-md">
                   {localPlayer.name} (You)
                </Badge>
                <div className="flex gap-2 items-center">
                    {localPlayer.isBidder && <Badge title="Bidder"><Crown className="w-4 h-4" /> </Badge>}
                    {localPlayer.isPartner && <Badge variant="secondary" title="Partner"><Users className="w-4 h-4"/></Badge>}
                    <Badge variant="outline" className="flex items-center gap-1.5 px-2">
                        <Trophy className="w-3 h-3 text-yellow-500"/> {localPlayer.tricksWon || 0}
                    </Badge>
                </div>
            </div>
        </div>

        {/* Current Player's Hand */}
        <div className="absolute bottom-[200px] left-0 right-0 flex justify-center items-end" style={{ height: '200px', pointerEvents: 'none' }}>
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
                style={{ zIndex: i, pointerEvents: 'auto' }}
                className="absolute"
              >
                <CardUI 
                  card={card} 
                  isFaceUp={true} 
                  isPlayable={isHost && gameState.phase === 'playing' && currentPlayerId === localPlayerId && !isProcessing}
                  onClick={() => handlePlayCard(card)} 
                />
              </motion.div>
            ))}
            </AnimatePresence>
        </div>
        
        <AnimatePresence>
        {isHost && currentPlayerId === localPlayerId && !isProcessing && gameState.phase === 'bidding' && (
            <motion.div 
                key="action-area"
                initial={{y:100, opacity:0}} animate={{y:0, opacity:1}} exit={{y:100, opacity:0}} 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card p-4 rounded-lg shadow-lg flex items-center gap-4 border z-30"
            >
            
                <>
                    <h3 className="text-lg font-bold">Your Bid:</h3>
                    <Input type="number" value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))} step={5} className="w-32" />
                    <Button onClick={() => handlePlaceBid(bidAmount)} disabled={isProcessing}>Place Bid</Button>
                    <Button variant="outline" onClick={() => handlePass()} disabled={isProcessing}>Pass</Button>
                </>
            
            </motion.div>
        )}
        </AnimatePresence>
        
        <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Trump and Partners</DialogTitle>
              <DialogDescription>
                You won the bid with {gameState.highestBid?.amount}. Time to choose!
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
                                const bidderPlayer = players.find(p => p.id === gameState.highestBid?.playerId);
                                if (!bidderPlayer) return true;
                                return !bidderPlayer.hand.find(hc => hc.id === c.id);
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
              <Button onClick={handleConfirmPartners} disabled={isProcessing || !isHost}>Confirm and Start Game</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResults} onOpenChange={setShowResults}>
          <DialogContent>
              {gameState.phase === 'results' && gameState.highestBid && (
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
