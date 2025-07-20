'use client';
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { createInitialGameState } from "@/lib/gameService";
import type { GameState } from "@/lib/game";
import { Badge } from "../ui/badge";
import { User } from "lucide-react";

export default function Lobby() {
    const [view, setView] = useState<'main' | 'create' | 'name-players' | 'join' | 'game'>('main');
    const [playerNames, setPlayerNames] = useState<string[]>(['']);
    const [playerCount, setPlayerCount] = useState(4);
    const [gameCode, setGameCode] = useState('');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const { toast } = useToast();

    const handleGoToNamePlayers = () => {
        if (!playerNames[0] || !playerNames[0].trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        setPlayerNames(Array(playerCount).fill('').map((_, i) => i === 0 ? playerNames[0] : ''));
        setView('name-players');
    };

    const handlePlayerNameChange = (index: number, name: string) => {
        const newPlayerNames = [...playerNames];
        newPlayerNames[index] = name;
        setPlayerNames(newPlayerNames);
    };

    const handleStartGame = () => {
        if (playerNames.some(name => !name.trim())) {
            toast({ variant: 'destructive', title: 'Please enter a name for every player.' });
            return;
        }
        
        const initialPlayers = playerNames.map((name, i) => ({ id: i, name }));
        
        const newGame = createInitialGameState(playerCount, initialPlayers);
        setGameState(newGame);
        setView('game');
    };

    const handleJoinGame = () => {
        if (!playerNames[0] || !playerNames[0].trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        if (!gameCode.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a game code.' });
            return;
        }
        // This is a placeholder for a real multiplayer implementation
        toast({ title: 'Joining Game (Simulated)', description: 'In a real game, you would connect to a server.' });
    };

    if (view === 'game' && gameState) {
        return <GameBoard initialGameState={gameState} />;
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
                    <CardDescription>The classic card game, now multiplayer.</CardDescription>
                </CardHeader>
                <CardContent>
                    {view === 'main' && (
                         <motion.div key="main" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="player-name">Your Name</Label>
                                <Input id="player-name" placeholder="Enter your name..." value={playerNames[0]} onChange={(e) => handlePlayerNameChange(0, e.target.value)} />
                            </div>
                             <div className="flex flex-col space-y-2">
                                <Button className="w-full h-12 text-lg" onClick={() => playerNames[0].trim() ? setView('create') : toast({variant: 'destructive', title: 'Please enter your name.'})}>Create Table</Button>
                                <Button variant="secondary" className="w-full h-12 text-lg" onClick={() => playerNames[0].trim() ? setView('join') : toast({variant: 'destructive', title: 'Please enter your name.'})}>Join Table</Button>
                             </div>
                         </motion.div>
                    )}
                    {view === 'create' && (
                        <motion.div key="create" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="space-y-4">
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
                            <Button className="w-full" onClick={handleGoToNamePlayers}>Set Up Table</Button>
                            <Button variant="link" onClick={() => setView('main')}>Back</Button>
                        </motion.div>
                    )}
                    {view === 'name-players' && (
                        <motion.div key="name-players" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="space-y-4">
                            <CardTitle>Name Your Players</CardTitle>
                            <CardDescription>You'll be controlling all of them for this local game.</CardDescription>
                             <div className="space-y-3 pt-2">
                                {playerNames.map((name, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <Label htmlFor={`p${index}-name`} className="w-20">Player {index + 1}</Label>
                                        <Input 
                                          id={`p${index}-name`} 
                                          placeholder={`Enter name for Player ${index + 1}`} 
                                          value={name}
                                          onChange={e => handlePlayerNameChange(index, e.target.value)}
                                          disabled={index === 0}
                                        />
                                    </div>
                                ))}
                            </div>
                            <Button className="w-full" onClick={handleStartGame}>Start Game</Button>
                            <Button variant="link" onClick={() => setView('create')}>Back</Button>
                        </motion.div>
                    )}
                    {view === 'join' && (
                        <motion.div key="join" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="game-code">Game Code</Label>
                                <Input id="game-code" placeholder="Enter 4-digit code..." value={gameCode} onChange={(e) => setGameCode(e.target.value)} />
                            </div>
                            <Button className="w-full" onClick={handleJoinGame}>Join Game</Button>
                            <Button variant="link" onClick={() => setView('main')}>Back</Button>
                        </motion.div>
                    )}
                </CardContent>
                { gameState && <CardFooter><Badge>Game ID: {gameState.id}</Badge></CardFooter>}
            </Card>
            </motion.div>
        </div>
    );
}
