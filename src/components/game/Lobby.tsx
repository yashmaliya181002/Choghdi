
'use client';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { type GameState, createDeck, dealCards } from "@/lib/game";
import { Loader2, Users, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGameConnection } from "@/hooks/useGameConnection";

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
            id: '', // This will be replaced by the 4-digit code from the service
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
            toast({ variant: 'destructive', title: 'Please enter your name and a game code.' });
            return;
        }
        if (!/^\d{4}$/.test(joinGameId)) {
            toast({ variant: 'destructive', title: 'Invalid Code', description: 'Game code must be a 4-digit number.' });
            return;
        }
        setIsLoading(true);
        await joinGame(joinGameId);
        // Transition to lobby will be handled by state updates from the host
        setView('lobby');
        setIsLoading(false);
    };

    const handleStartGame = () => {
        if (!gameState || role !== 'host') return;
        setIsLoading(true);

        let updatedState = { ...gameState };
        
        // Deal cards and set game to bidding phase
        const dealtPlayers = dealCards(updatedState.deck, updatedState.players);
        updatedState.players = dealtPlayers;
        updatedState.phase = 'bidding';
        updatedState.turnHistory.push(`The game has started!`);
        
        broadcastGameState(updatedState); // Send the final "start game" state to all peers
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
            <div className="w-full h-screen flex items-center justify-center bg-background p-4">
                 <Card className="w-full max-w-md shadow-2xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold text-primary">Game Lobby</CardTitle>
                        <CardDescription>Share this code with your friends!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-center">
                            <div className="text-4xl font-mono tracking-widest bg-muted p-4 rounded-lg border flex items-center gap-4">
                                {gameState.id ? (
                                    <>
                                        <span>{gameState.id}</span>
                                        <Button variant="ghost" size="icon" onClick={copyGameId}><Copy className="w-6 h-6"/></Button>
                                    </>
                                ) : (
                                    <Loader2 className="animate-spin" />
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-lg"><Users /> Players ({gameState.players.length}/{gameState.playerCount})</Label>
                            <div className="space-y-1 rounded-md bg-muted p-3">
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
        <div className="w-full h-screen flex items-center justify-center bg-background p-4">
            <motion.div
                layout
                className="w-full max-w-md"
            >
            <Card className="shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-4xl font-bold text-primary mb-2">Kaali Teeri</CardTitle>
                    <CardDescription>The classic card game, online.</CardDescription>
                </CardHeader>
                <CardContent>
                     <motion.div key="main" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{opacity: 0, x: 50}} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="player-name">Your Name</Label>
                            <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                        </div>
                        {status === 'connecting' && <div className="flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 animate-spin"/>Connecting to server...</div>}
                        
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
                                   {isLoading ? <Loader2 className="animate-spin" /> : 'Create Table'}
                                </Button>
                            </div>
                        </div>
                        
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="game-id">Game Code</Label>
                                <Input id="game-id" placeholder="Enter 4-digit code..." value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} maxLength={4} />
                            </div>
                             <div className="flex flex-col justify-end">
                                <Button variant="secondary" className="w-full h-10" onClick={handleJoinGame} disabled={isLoading || status !== 'connected'}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Join Game'}
                                </Button>
                             </div>
                         </div>
                     </motion.div>
                </CardContent>
            </Card>
            </motion.div>
        </div>
    );
}
