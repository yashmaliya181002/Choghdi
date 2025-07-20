'use client';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { createNewGame, joinGame, getGameState, updateGameState as updateGameStateOnServer } from "@/lib/gameService";
import type { GameState, Player } from "@/lib/game";
import { Badge } from "../ui/badge";
import { User, Loader2 } from "lucide-react";

type View = 'main' | 'create' | 'join' | 'lobby' | 'game';

export default function Lobby() {
    const [view, setView] = useState<View>('main');
    const [playerName, setPlayerName] = useState('');
    const [playerCount, setPlayerCount] = useState(4);
    const [gameId, setGameId] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [localPlayerId, setLocalPlayerId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Polling to simulate real-time updates from a server
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if ((view === 'lobby' || view === 'game') && gameId) {
            interval = setInterval(async () => {
                const updatedState = await getGameState(gameId);
                if (updatedState) {
                    // Check if the game has started
                    if (gameState?.phase === 'lobby' && updatedState.phase === 'bidding') {
                        setView('game');
                    }
                    setGameState(updatedState);
                }
            }, 2000); // Poll every 2 seconds
        }
        return () => clearInterval(interval);
    }, [view, gameId, gameState?.phase]);


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
            setLocalPlayerId(0); // The creator is always player 0
            setView('lobby');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to create game', description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleJoinGame = async () => {
        if (!playerName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        if (!joinCode.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a game code.' });
            return;
        }
        setIsLoading(true);
        try {
            const { updatedState, newPlayerId } = await joinGame(joinCode, playerName);
            setGameState(updatedState);
            setGameId(updatedState.id);
            setLocalPlayerId(newPlayerId);
            setView('lobby');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to join game', description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStartGame = async () => {
        if (!gameState) return;
        const updatedState = { ...gameState, phase: 'bidding' as const };
        await updateGameState(updatedState);
        setView('game');
    };

    const updateGameState = async (newState: GameState) => {
        await updateGameStateOnServer(newState);
        setGameState(newState);
    };


    if (view === 'game' && gameState && localPlayerId !== null) {
        return <GameBoard initialGameState={gameState} localPlayerId={localPlayerId} onGameStateChange={updateGameState} />;
    }

    const renderLobby = () => {
        if (!gameState) return null;
        const host = gameState.players.find(p => p.id === 0);
        const isHost = localPlayerId === 0;

        return (
             <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <CardTitle>Game Lobby</CardTitle>
                <CardDescription>Share this code with your friends!</CardDescription>
                <div className="flex justify-center">
                    <Badge variant="secondary" className="text-2xl font-bold tracking-widest p-4">{gameId}</Badge>
                </div>
                <div className="space-y-2">
                    <Label>Players ({gameState.players.length}/{gameState.playerCount})</Label>
                    <div className="bg-muted p-3 rounded-md space-y-2">
                        {gameState.players.map(p => (
                            <div key={p.id} className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>{p.name} {p.id === host?.id && "(Host)"}</span>
                            </div>
                        ))}
                    </div>
                </div>
                {isHost ? (
                    <Button 
                        className="w-full" 
                        onClick={handleStartGame}
                        disabled={gameState.players.length !== gameState.playerCount || isLoading}
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Start Game'}
                    </Button>
                ) : (
                    <p className="text-center text-muted-foreground">Waiting for the host to start the game...</p>
                )}
            </motion.div>
        )
    };
    

    return (
        <div className="w-full h-screen flex items-center justify-center bg-background p-4">
            <motion.div
                layout
                className="w-full max-w-md"
            >
            <Card className="shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-4xl font-bold text-primary mb-2">Kaali Teeri</CardTitle>
                    <CardDescription>The classic card game, now multiplayer.</CardDescription>
                </CardHeader>
                <CardContent>
                    {view === 'main' && (
                         <motion.div key="main" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="player-name">Your Name</Label>
                                <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                            </div>
                             <div className="flex flex-col space-y-2">
                                <Button className="w-full h-12 text-lg" onClick={() => playerName.trim() ? setView('create') : toast({variant: 'destructive', title: 'Please enter your name.'})}>Create Table</Button>
                                <Button variant="secondary" className="w-full h-12 text-lg" onClick={() => playerName.trim() ? setView('join') : toast({variant: 'destructive', title: 'Please enter your name.'})}>Join Table</Button>
                             </div>
                         </motion.div>
                    )}
                    {view === 'create' && (
                        <motion.div key="create" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="player-count">Number of Players</Label>
                                <Select defaultValue={String(playerCount)} onValueChange={(val) => setPlayerCount(parseInt(val))}>
                                    <SelectTrigger id="player-count">
                                    <SelectValue placeholder="Select player count..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {[4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>{n} Players</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button className="w-full" onClick={handleCreateGame} disabled={isLoading}>
                               {isLoading ? <Loader2 className="animate-spin" /> : 'Create Table'}
                            </Button>
                            <Button variant="link" onClick={() => setView('main')}>Back</Button>
                        </motion.div>
                    )}
                    {view === 'join' && (
                        <motion.div key="join" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="game-code">Game Code</Label>
                                <Input id="game-code" placeholder="Enter 4-digit code..." value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                            </div>
                            <Button className="w-full" onClick={handleJoinGame} disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin" /> : 'Join Game'}
                            </Button>
                            <Button variant="link" onClick={() => setView('main')}>Back</Button>
                        </motion.div>
                    )}
                     {view === 'lobby' && renderLobby()}
                </CardContent>
                { gameState && <CardFooter><Badge>Game ID: {gameState.id}</Badge></CardFooter>}
            </Card>
            </motion.div>
        </div>
    );
}
