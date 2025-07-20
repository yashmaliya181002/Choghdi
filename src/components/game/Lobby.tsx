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
import { createNewGame, updateGameState as updateGameStateOnServer } from "@/lib/gameService";
import type { GameState } from "@/lib/game";
import { Loader2 } from "lucide-react";

type View = 'main' | 'game';

export default function Lobby() {
    const [view, setView] = useState<View>('main');
    const [playerName, setPlayerName] = useState('');
    const [playerCount, setPlayerCount] = useState(4);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleCreateGame = async () => {
        if (!playerName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter your name.' });
            return;
        }
        setIsLoading(true);
        try {
            const newGame = await createNewGame(playerCount, playerName);
            setGameState(newGame);
            setView('game');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to create game', description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGameStateChange = (newState: GameState) => {
        // In a real multiplayer app, this would be an API call.
        // For Player vs AI, we just update the local state.
        setGameState(newState);
    };

    if (view === 'game' && gameState) {
        return <GameBoard initialGameState={gameState} localPlayerId={0} onGameStateChange={handleGameStateChange} />;
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
                    <CardDescription>The classic card game vs. AI opponents.</CardDescription>
                </CardHeader>
                <CardContent>
                     <motion.div key="main" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="player-name">Your Name</Label>
                            <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                        </div>
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
                         <div className="flex flex-col space-y-2">
                            <Button className="w-full h-12 text-lg" onClick={handleCreateGame} disabled={isLoading}>
                               {isLoading ? <Loader2 className="animate-spin" /> : 'Play against AI'}
                            </Button>
                         </div>
                     </motion.div>
                </CardContent>
            </Card>
            </motion.div>
        </div>
    );
}
