'use client';
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { createInitialGameState } from "@/lib/gameService";
import type { GameState } from "@/lib/game";

export default function Lobby() {
    const [view, setView] = useState<'main' | 'create' | 'join' | 'game'>('main');
    const [playerName, setPlayerName] = useState('');
    const [playerCount, setPlayerCount] = useState(4);
    const [gameCode, setGameCode] = useState('');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [localPlayerId, setLocalPlayerId] = useState<number | null>(null);
    const { toast } = useToast();

    const handleCreateGame = () => {
        if (!playerName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        // In a real app, this would call a server function
        const newGame = createInitialGameState(playerCount, [{ id: 0, name: playerName }]);
        setGameState(newGame);
        setLocalPlayerId(0);
        setView('game');
    };

    const handleJoinGame = () => {
        if (!playerName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        if (!gameCode.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a game code.' });
            return;
        }
        // In a real app, this would find the game on the server and add the player
        toast({ title: 'Joining game...', description: 'This is a simulation.' });
    };

    if (view === 'game' && gameState && localPlayerId !== null) {
        return <GameBoard initialGameState={gameState} localPlayerId={localPlayerId} />;
    }

    return (
        <div className="w-full h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-4xl font-bold text-primary mb-2">Kaali Teeri Online</CardTitle>
                    <CardDescription>The classic card game, multiplayer.</CardDescription>
                </CardHeader>
                <CardContent>
                    {view === 'main' && (
                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="player-name">Your Name</Label>
                                <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                            </div>
                             <div className="flex flex-col space-y-2">
                                <Button className="w-full h-12 text-lg" onClick={() => setView('create')}>Create Table</Button>
                                <Button variant="secondary" className="w-full h-12 text-lg" onClick={() => setView('join')}>Join Table</Button>
                             </div>
                         </motion.div>
                    )}
                    {view === 'create' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
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
                            <Button className="w-full" onClick={handleCreateGame}>Start Game</Button>
                            <Button variant="link" onClick={() => setView('main')}>Back</Button>
                        </motion.div>
                    )}
                    {view === 'join' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="game-code">Game Code</Label>
                                <Input id="game-code" placeholder="Enter 4-digit code..." value={gameCode} onChange={(e) => setGameCode(e.target.value)} />
                            </div>
                            <Button className="w-full" onClick={handleJoinGame}>Join Game</Button>
                            <Button variant="link" onClick={() => setView('main')}>Back</Button>
                        </motion.div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
