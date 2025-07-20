
'use client';
import { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { type GameState, createDeck, dealCards } from "@/lib/game";
import { Loader2, Users, Copy, Link as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGameConnection } from "@/hooks/useGameConnection";
import { SpadeIcon } from "./SuitIcons";
import { CardUI } from "./CardUI";

type View = 'main' | 'lobby' | 'game';

export default function Lobby() {
    const [view, setView] = useState<View>('main');
    const [playerName, setPlayerName] = useState('');
    const [playerCount, setPlayerCount] = useState(4);
    const [joinGameId, setJoinGameId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const searchParams = useSearchParams();
    const gameToJoin = searchParams.get('join');

    const { myPeerId, status, role, gameState, hostGame, joinGame, broadcastGameState } = useGameConnection(playerName);

    useEffect(() => {
        if (gameToJoin && playerName && status === 'connected' && role === 'none' && !gameState) {
            handleJoinFromUrl(gameToJoin);
        }
    }, [gameToJoin, playerName, status, role, gameState]);
    
    const handleJoinFromUrl = async (hostId: string) => {
        setIsLoading(true);
        await joinGame(hostId);
        setView('lobby');
        setIsLoading(false);
    };

    useEffect(() => {
        if (gameState?.phase && gameState.phase !== 'lobby') {
            setView('game');
        } else if (gameState?.phase === 'lobby') {
            setView('lobby');
        } else {
            setView('main');
        }
    }, [gameState]);

    const handleCreateGame = async () => {
        if (!playerName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        if (status !== 'connected') {
            toast({ variant: 'destructive', title: 'Connection not ready', description: 'Please wait a moment and try again.' });
            return;
        }
        setIsLoading(true);

        const hostPlayer = {
            id: 0, name: playerName, hand: [], isBidder: false, isPartner: false, collectedCards: [], tricksWon: 0, peerId: myPeerId
        };
        
        const initialGameState: GameState = {
            id: myPeerId, 
            hostPeerId: myPeerId,
            phase: 'lobby',
            playerCount,
            players: [hostPlayer],
            deck: createDeck(playerCount),
            bids: [],
            highestBid: null,
            trumpSuit: null,
            partnerCards: [],
            currentPlayerId: 0,
            currentTrick: { cards: [], leadingSuit: null },
            tricksPlayed: 0,
            team1Score: 0,
            team2Score: 0,
            turnHistory: [`Game created by ${playerName}`],
        };

        await hostGame(initialGameState);
        setView('lobby');
        setIsLoading(false);
    };
    
    const handleJoinGame = async () => {
        if (!playerName.trim() || !joinGameId.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name and a game ID.' });
            return;
        }
        setIsLoading(true);
        await joinGame(joinGameId);
        setView('lobby');
        setIsLoading(false);
    };

    const handleStartGame = () => {
        if (!gameState || role !== 'host') return;
        setIsLoading(true);

        let updatedState = { ...gameState };
        
        const dealtPlayers = dealCards(updatedState.deck, updatedState.players);
        updatedState.players = dealtPlayers;
        updatedState.phase = 'bidding';
        updatedState.turnHistory.push(`The game has started!`);
        
        broadcastGameState(updatedState);
        setView('game');
        setIsLoading(false);
    }

    const copyGameLink = () => {
        if (!gameState?.hostPeerId) return;
        const joinLink = `${window.location.origin}${window.location.pathname}?join=${gameState.hostPeerId}`;
        navigator.clipboard.writeText(joinLink);
        toast({ title: "Copied!", description: "Game link copied to clipboard." });
    }

    if (view === 'game' && gameState) {
        const localPlayer = gameState.players.find(p => p.peerId === myPeerId);
        if (!localPlayer) return <div className="w-full h-screen flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> Joining game...</div>

        return <GameBoard
            initialGameState={gameState}
            localPlayerId={localPlayer.id}
            isHost={role === 'host'}
            broadcastGameState={role === 'host' ? broadcastGameState : undefined}
        />;
    }

    if (view === 'lobby' && gameState) {
        const isHost = role === 'host';
        const allPlayersJoined = gameState.players.length === gameState.playerCount;

        return (
            <div className="w-full h-screen flex items-center justify-center bg-lobby p-4" data-ai-hint="casino background">
                 <Card className="w-full max-w-md shadow-2xl bg-card/80 backdrop-blur-sm border-white/20">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold text-primary">Game Lobby</CardTitle>
                        <CardDescription>Share the link with your friends to join!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center justify-center gap-2">
                             <Label>Share Game ID</Label>
                            <div className="text-sm font-mono tracking-widest bg-muted/50 p-2 rounded-lg border w-full text-center truncate">
                               {gameState.hostPeerId}
                            </div>
                            <Button variant="outline" onClick={copyGameLink} className="w-full">
                               <Copy className="mr-2" /> Copy Game ID
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-lg"><Users /> Players ({gameState.players.length}/{gameState.playerCount})</Label>
                            <div className="space-y-1 rounded-md bg-muted/50 p-3">
                                {gameState.players.map(p => (
                                    <div key={p.id} className="flex items-center justify-between">
                                        <span>{p.name} {p.peerId === myPeerId && '(You)'}</span>
                                        {p.id === 0 && <Badge>Host</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isHost && (
                             <Button className="w-full h-12 text-lg" onClick={handleStartGame} disabled={!allPlayersJoined || isLoading}>
                                {isLoading ? <Loader2 className="animate-spin"/> : (allPlayersJoined ? 'Start Game' : `Waiting for ${gameState.playerCount - gameState.players.length} more players...`)}
                             </Button>
                        )}
                        {!isHost && <p className="text-center text-muted-foreground">Waiting for the host to start the game...</p>}
                    </CardContent>
                 </Card>
            </div>
        )
    }

    return (
        <div className="w-full h-screen flex items-center justify-center bg-gamemat p-4 overflow-hidden" data-ai-hint="poker table cards chips">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-full max-w-lg"
            >
                {/* Decorative cards */}
                <motion.div 
                    initial={{ y: 0, rotate: -15 }}
                    animate={{ y: -10, rotate: -20 }}
                    transition={{ type: 'spring', stiffness: 100, repeat: Infinity, repeatType: 'reverse', duration: 2}}
                    className="absolute -top-16 -left-28 z-0"
                >
                    <CardUI card={{id: 'AS', suit: 'spades', rank: 'A'}} isFaceUp={true} className="!w-32 !h-44 shadow-2xl" />
                </motion.div>
                <motion.div
                     initial={{ y: 0, rotate: 10 }}
                     animate={{ y: -10, rotate: 15 }}
                     transition={{ type: 'spring', stiffness: 100, repeat: Infinity, repeatType: 'reverse', duration: 2.2, delay: 0.5}}
                     className="absolute -bottom-20 -right-24 z-0"
                >
                    <CardUI card={{id: 'KH', suit: 'hearts', rank: 'K'}} isFaceUp={true} className="!w-32 !h-44 shadow-2xl" />
                </motion.div>
                
                <div className="relative z-10 w-[500px] h-[500px] bg-white/20 backdrop-blur-md rounded-full flex flex-col items-center justify-center p-8 shadow-2xl border-4 border-white/30">
                    <div className="text-center">
                        <h1 className="text-5xl font-black text-foreground drop-shadow-lg flex items-center justify-center gap-2">
                            Kaali 3 <SpadeIcon className="w-10 h-10 text-foreground"/> 250
                        </h1>
                        <p className="text-xl text-foreground/80 font-semibold tracking-wider mt-1">Play Bid Enjoy</p>
                    </div>
                    <div className="w-full max-w-sm mt-8 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="player-name" className="text-foreground/90">Your Name</Label>
                            <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="bg-white/20 border-black/20 text-black placeholder:text-gray-600 focus:bg-white/30"/>
                        </div>
                        {status === 'connecting' && <div className="flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 animate-spin"/>Connecting...</div>}
                        
                        <div className="flex items-end gap-4">
                            <div className="space-y-2 flex-grow">
                                <Label htmlFor="player-count" className="text-foreground/90">Players</Label>
                                <Select defaultValue={String(playerCount)} onValueChange={(val) => setPlayerCount(parseInt(val))} disabled={isLoading}>
                                    <SelectTrigger id="player-count" className="bg-white/20 border-black/20 text-black">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {[4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>{n} Players</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button className="w-full h-10 flex-[2]" onClick={handleCreateGame} disabled={isLoading || status !== 'connected' || !playerName}>
                               {isLoading ? <Loader2 className="animate-spin" /> : 'Create Game'}
                            </Button>
                        </div>
                        
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/20" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white/20 backdrop-blur-md px-2 text-foreground/80 rounded-full">Or</span></div>
                        </div>

                         <div className="flex items-end gap-4">
                            <div className="space-y-2 flex-grow">
                                <Label htmlFor="game-id" className="text-foreground/90">Game Code</Label>
                                <Input id="game-id" placeholder="Enter game code from host..." value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} className="bg-white/20 border-black/20 text-black placeholder:text-gray-600 focus:bg-white/30" />
                            </div>
                             <Button variant="secondary" className="w-full h-10 flex-[2]" onClick={handleJoinGame} disabled={isLoading || status !== 'connected' || !playerName || !joinGameId}>
                                Join Game
                             </Button>
                         </div>
                         <p className="text-xs text-center text-foreground/70 pt-2">To join, paste the host's full ID they provide.</p>
                     </div>
                </div>
            </motion.div>
        </div>
    );
}
