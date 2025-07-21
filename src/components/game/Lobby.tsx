'use client';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { type GameState, createDeck, dealCards } from "@/lib/game";
import { Loader2, Users, Copy, Sprout, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGameConnection } from "@/hooks/useGameConnection";
import { SpadeIcon, HeartIcon, DiamondIcon, ClubIcon } from './SuitIcons';

type View = 'main' | 'lobby' | 'game';

export default function Lobby() {
    const [view, setView] = useState<View>('main');
    const [playerName, setPlayerName] = useState('');
    const [playerCount, setPlayerCount] = useState(4);
    const [joinGameId, setJoinGameId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const { myPeerId, status, role, gameState, hostGame, joinGame, broadcastGameState } = useGameConnection(playerName);

    useEffect(() => {
        if (gameState?.phase && gameState.phase !== 'lobby') {
            setView('game');
        } else if (gameState?.phase === 'lobby') {
            setView('lobby');
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
            id: '', // This will be replaced by the room code
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
        setIsLoading(false);
    };
    
    const handleJoinGame = async () => {
        if (!playerName.trim() || !joinGameId.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name and a 4-digit game code.' });
            return;
        }
        if (joinGameId.length !== 4 || !/^\d{4}$/.test(joinGameId)) {
            toast({ variant: 'destructive', title: 'Invalid Code', description: 'The game code must be exactly 4 digits.' });
            return;
        }
        
        setIsLoading(true);
        await joinGame(joinGameId);
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

    const copyGameId = () => {
        if (!gameState?.id) return;
        navigator.clipboard.writeText(gameState.id);
        toast({ title: "Copied!", description: "Game code copied to clipboard." });
    }

    if (view === 'game' && gameState) {
        const localPlayer = gameState.players.find(p => p.peerId === myPeerId);
        if (!localPlayer) return <div className="w-full h-screen flex items-center justify-center game-background"><Loader2 className="animate-spin mr-2" /> Joining game...</div>

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
            <div className="w-full h-screen flex items-center justify-center p-4">
                 <UICard className="w-full max-w-md shadow-2xl bg-card/90 backdrop-blur-sm border-black/20">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold text-primary">Game Lobby</CardTitle>
                        <CardDescription>Share the 4-digit code with your friends!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-center">
                            <div className="text-4xl font-mono tracking-widest bg-muted/80 p-4 rounded-lg border-2 border-primary/50 flex items-center justify-center gap-4 w-full break-all">
                                {gameState.id ? (
                                    <>
                                        <span className="flex-1 text-center text-accent font-bold">{gameState.id}</span>
                                        <Button variant="ghost" size="icon" onClick={copyGameId}><Copy className="w-6 h-6"/></Button>
                                    </>
                                ) : (
                                    <Loader2 className="animate-spin" />
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-lg font-bold"><Users /> Players ({gameState.players.length}/{gameState.playerCount})</Label>
                            <div className="space-y-2 rounded-md bg-muted/80 p-3 border">
                                {gameState.players.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-background/50">
                                        <span className="font-semibold">{p.name} {p.peerId === myPeerId && '(You)'}</span>
                                        {p.id === 0 && <Badge>Host</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isHost && (
                             <Button className="w-full h-12 text-lg font-bold bg-accent hover:bg-accent/90" onClick={handleStartGame} disabled={!allPlayersJoined || isLoading}>
                                {isLoading ? <Loader2 className="animate-spin"/> : (allPlayersJoined ? 'Start Game' : `Waiting for ${gameState.playerCount - gameState.players.length} more players...`)}
                             </Button>
                        )}
                        {!isHost && <div className="flex items-center justify-center text-muted-foreground p-3 bg-muted/50 rounded-md"><Loader2 className="mr-2 animate-spin"/>Waiting for the host to start the game...</div>}
                    </CardContent>
                 </UICard>
            </div>
        )
    }

    return (
        <div className="w-full h-screen flex items-center justify-center p-4 relative overflow-hidden">
             {/* Decorative elements */}
            <SpadeIcon className="absolute -bottom-12 -left-12 text-black/5 w-48 h-48 rotate-[-30deg]" />
            <HeartIcon className="absolute -top-20 -right-16 text-red-500/5 w-56 h-56 rotate-[20deg]" />
            <ClubIcon className="absolute bottom-24 right-10 text-black/5 w-32 h-32 rotate-[15deg]"/>
            <DiamondIcon className="absolute top-24 left-10 text-red-500/5 w-24 h-24 rotate-[15deg]"/>

            <motion.div
                layout
                className="w-full max-w-md z-10"
            >
            <UICard className="shadow-2xl bg-card/90 backdrop-blur-sm border-black/20">
                <CardHeader className="text-center">
                    <CardTitle className="text-4xl font-bold text-primary mb-2">Kaali Teeri</CardTitle>
                    <CardDescription>The classic card game, brought online.</CardDescription>
                </CardHeader>
                <CardContent>
                     <motion.div key="main" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{opacity: 0, x: 50}} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="player-name">Your Name</Label>
                            <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                        </div>
                        {status === 'connecting' && <div className="flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 animate-spin"/>Connecting...</div>}
                        
                        <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                            <h3 className="text-lg font-bold text-center text-primary">Create a New Game</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="player-count">Players</Label>
                                    <Select defaultValue={String(playerCount)} onValueChange={(val) => setPlayerCount(parseInt(val))} disabled={isLoading}>
                                        <SelectTrigger id="player-count">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        {[4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>{n} Players</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <Button className="w-full h-10" onClick={handleCreateGame} disabled={isLoading || status !== 'connected'}>
                                       {isLoading && !gameState ? <Loader2 className="animate-spin" /> : 'Create Table'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                        </div>
                        
                         <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                            <h3 className="text-lg font-bold text-center text-primary">Join a Game</h3>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="game-id">4-Digit Code</Label>
                                    <Input id="game-id" placeholder="1234" value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} />
                                </div>
                                 <div className="flex flex-col justify-end">
                                    <Button variant="secondary" className="w-full h-10" onClick={handleJoinGame} disabled={isLoading || status !== 'connected'}>
                                        {isLoading && !!joinGameId ? <Loader2 className="animate-spin" /> : 'Join Game'}
                                    </Button>
                                 </div>
                             </div>
                         </div>
                     </motion.div>
                </CardContent>
            </UICard>
            </motion.div>
        </div>
    );
}
