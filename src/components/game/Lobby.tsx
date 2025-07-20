'use client';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { createNewGame, joinGame, getGameState, updateGameState } from "@/lib/gameService";
import type { GameState } from "@/lib/game";
import { Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type View = 'main' | 'lobby' | 'game';

export default function Lobby() {
    const [view, setView] = useState<View>('main');
    const [playerName, setPlayerName] = useState('');
    const [playerCount, setPlayerCount] = useState(4);
    const [gameId, setGameId] = useState('');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [localPlayerId, setLocalPlayerId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Persist and retrieve session info to handle reloads
    useEffect(() => {
        const savedGameId = sessionStorage.getItem('kt_gameId');
        const savedPlayerId = sessionStorage.getItem('kt_playerId');
        if (savedGameId && savedPlayerId) {
            setIsLoading(true);
            getGameState(savedGameId).then(gs => {
                if (gs) {
                    setGameId(savedGameId);
                    setLocalPlayerId(parseInt(savedPlayerId, 10));
                    setGameState(gs);
                    if (gs.phase === 'lobby') {
                        setView('lobby');
                    } else {
                        setView('game');
                    }
                } else {
                    sessionStorage.clear(); // Game doesn't exist anymore
                }
            }).finally(() => setIsLoading(false));
        }
    }, []);

    const handleCreateGame = async () => {
        if (!playerName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        setIsLoading(true);
        try {
            const newGame = await createNewGame(playerCount, playerName);
            setGameState(newGame);
            setGameId(newGame.id);
            setLocalPlayerId(newGame.players[0].id);
            sessionStorage.setItem('kt_gameId', newGame.id);
            sessionStorage.setItem('kt_playerId', newGame.players[0].id.toString());
            setView('lobby');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to create game', description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleJoinGame = async () => {
        if (!playerName.trim() || !gameId.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name and a game code.' });
            return;
        }
        setIsLoading(true);
        try {
            const result = await joinGame(gameId, playerName);
            setGameState(result.updatedState);
            setLocalPlayerId(result.newPlayerId);
            sessionStorage.setItem('kt_gameId', result.updatedState.id);
            sessionStorage.setItem('kt_playerId', result.newPlayerId.toString());
            setView('lobby');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to join game', description: (error as Error).message || "Please check the code and try again." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartGame = async () => {
        if (!gameState || !gameId) return;
        setIsLoading(true);
        try {
            let updatedState = await getGameState(gameId);
            if(updatedState){
                updatedState.phase = 'bidding';
                const finalState = await updateGameState(updatedState);
                setGameState(finalState);
                setView('game');
            }
        } catch(e) {
            toast({variant: 'destructive', title: 'Could not start game'});
        } finally {
            setIsLoading(false);
        }
    }
    
    // Polling effect for the lobby
    useEffect(() => {
        if (view !== 'lobby' || !gameId) return;

        const interval = setInterval(async () => {
            const updatedGameState = await getGameState(gameId);
            if (updatedGameState) {
                setGameState(updatedGameState);
                // If host started the game, transition for all players
                if(updatedGameState.phase !== 'lobby') {
                    setView('game');
                }
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [view, gameId]);


    if (view === 'game' && gameState && localPlayerId !== null) {
        return <GameBoard initialGameState={gameState} localPlayerId={localPlayerId} />;
    }

    if (view === 'lobby' && gameState) {
        const isHost = localPlayerId === 0;
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
                            <div className="text-4xl font-mono tracking-widest bg-muted p-4 rounded-lg border">
                                {gameState.id}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-lg"><Users /> Players ({gameState.players.length}/{gameState.playerCount})</Label>
                            <div className="space-y-1 rounded-md bg-muted p-3">
                                {gameState.players.map(p => (
                                    <div key={p.id} className="flex items-center justify-between">
                                        <span>{p.name}</span>
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
                    <AnimatePresence mode="wait">
                     <motion.div key="main" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{opacity: 0, x: 50}} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="player-name">Your Name</Label>
                            <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="player-count">Players</Label>
                                <Select defaultValue={String(playerCount)} onValueChange={(val) => setPlayerCount(parseInt(val))}>
                                    <SelectTrigger id="player-count">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {[4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>{n} Players</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col justify-end">
                                <Button className="w-full h-10" onClick={handleCreateGame} disabled={isLoading}>
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
                                <Input id="game-id" placeholder="4-digit code..." value={gameId} onChange={(e) => setGameId(e.target.value.toUpperCase())} />
                            </div>
                             <div className="flex flex-col justify-end">
                                <Button variant="secondary" className="w-full h-10" onClick={handleJoinGame} disabled={isLoading}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Join Game'}
                                </Button>
                             </div>
                         </div>
                     </motion.div>
                    </AnimatePresence>
                </CardContent>
            </Card>
            </motion.div>
        </div>
    );
}
