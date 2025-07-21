'use client';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./GameBoard";
import { type GameState, createDeck, dealCards } from "@/lib/game";
import { Loader2, Users, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGameConnection } from "@/hooks/useGameConnection";

type LobbyProps = {
    gameId: string;
    initialPlayerName: string;
    isHost: boolean;
    initialPlayerCount?: number; // Only host knows this initially
};

export default function Lobby({ gameId, initialPlayerName, isHost, initialPlayerCount }: LobbyProps) {
    const [view, setView] = useState<'lobby' | 'game'>('lobby');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const { myPeerId, role, gameState, hostGame, joinGame, broadcastGameState } = useGameConnection(initialPlayerName, gameId);
    
    useEffect(() => {
        // This effect runs once the peer connection is established
        if (myPeerId) {
            if (isHost && initialPlayerCount) {
                const hostPlayer = {
                    id: 0, name: initialPlayerName, hand: [], isBidder: false, isPartner: false, collectedCards: [], tricksWon: 0, peerId: myPeerId
                };
                
                const initialGameState: GameState = {
                    id: gameId,
                    phase: 'lobby',
                    playerCount: initialPlayerCount,
                    players: [hostPlayer],
                    deck: createDeck(initialPlayerCount),
                    bids: [],
                    highestBid: null,
                    trumpSuit: null,
                    partnerCards: [],
                    currentPlayerId: 0,
                    currentTrick: { cards: [], leadingSuit: null },
                    tricksPlayed: 0,
                    team1Score: 0,
                    team2Score: 0,
                    turnHistory: [`Game created by ${initialPlayerName}`],
                };
                hostGame(initialGameState);
            } else {
                // This client is a peer joining the game.
                joinGame();
            }
        }
    }, [myPeerId, isHost, gameId, initialPlayerName, initialPlayerCount, hostGame, joinGame]);


    useEffect(() => {
        if (gameState?.phase && gameState.phase !== 'lobby') {
            setView('game');
        } else if (gameState?.phase === 'lobby') {
            setView('lobby');
        }
    }, [gameState]);

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
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        toast({ title: "Copied!", description: "Game link copied to clipboard." });
    }

    if (!gameState) {
        return (
             <div className="w-full h-screen flex flex-col items-center justify-center game-background text-foreground">
                <Loader2 className="animate-spin mr-2 h-8 w-8" />
                <p className="mt-2 text-lg">{role === 'host' ? 'Setting up your table...' : 'Joining game...'}</p>
            </div>
        )
    }

    if (view === 'game') {
        const localPlayer = gameState.players.find(p => p.peerId === myPeerId);
        if (!localPlayer) return <div className="w-full h-screen flex items-center justify-center game-background"><Loader2 className="animate-spin mr-2" /> Waiting for game state...</div>

        return <GameBoard
            initialGameState={gameState}
            localPlayerId={localPlayer.id}
            isHost={role === 'host'}
            broadcastGameState={role === 'host' ? broadcastGameState : undefined}
        />;
    }

    // Lobby View
    const allPlayersJoined = gameState.players.length === gameState.playerCount;
    return (
        <div className="w-full h-screen flex items-center justify-center p-4">
             <UICard className="w-full max-w-md shadow-2xl bg-card/90 backdrop-blur-sm border-black/20">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold text-primary">Game Lobby</CardTitle>
                    <CardDescription>Share the page link with your friends to join!</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-center">
                        <Button variant="outline" className="w-full" onClick={copyGameLink}>
                            <Copy className="w-4 h-4 mr-2"/>
                            Copy Game Link
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-lg font-bold"><Users /> Players ({gameState.players.length}/{gameState.playerCount})</Label>
                        <div className="space-y-2 rounded-md bg-muted/80 p-3 border h-40 overflow-y-auto">
                            {gameState.players.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-background/50">
                                    <span className="font-semibold">{p.name} {p.peerId === myPeerId && '(You)'}</span>
                                    {p.id === 0 && <Badge>Host</Badge>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {role === 'host' && (
                         <Button className="w-full h-12 text-lg font-bold bg-accent hover:bg-accent/90" onClick={handleStartGame} disabled={!allPlayersJoined || isLoading}>
                            {isLoading ? <Loader2 className="animate-spin"/> : (allPlayersJoined ? 'Start Game' : `Waiting for ${gameState.playerCount - gameState.players.length} more players...`)}
                         </Button>
                    )}
                    {role !== 'host' && <div className="flex items-center justify-center text-muted-foreground p-3 bg-muted/50 rounded-md"><Loader2 className="mr-2 animate-spin"/>Waiting for the host to start the game...</div>}
                </CardContent>
             </UICard>
        </div>
    )
}
