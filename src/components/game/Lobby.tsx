
'use client';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type GameState } from "@/lib/game";
import { Loader2, Users, Copy, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type LobbyProps = {
    gameState: GameState;
    myPeerId: string;
    isHost: boolean;
    onStartGame: () => void;
    isStartingGame: boolean;
};

export default function Lobby({ gameState, myPeerId, isHost, onStartGame, isStartingGame }: LobbyProps) {
    const { toast } = useToast();

    const roomCode = isHost ? myPeerId : gameState.id;

    const copyGameCode = () => {
        if (!roomCode) return;
        navigator.clipboard.writeText(roomCode);
        toast({ title: "Copied!", description: "Room code copied to clipboard." });
    }

    const shareGame = () => {
        if (navigator.share && roomCode) {
            navigator.share({
                title: 'Kaali Teeri Game',
                text: `Join my Kaali Teeri game with this code: ${roomCode}`,
                url: window.location.href
            }).catch(err => console.log("Couldn't share", err));
        } else {
            copyGameCode();
        }
    }

    if (!gameState) {
        return (
             <div className="w-full h-screen flex flex-col items-center justify-center game-background text-foreground">
                <Loader2 className="animate-spin mr-2 h-8 w-8" />
                <p className="mt-2 text-lg">Entering Lobby...</p>
            </div>
        )
    }
    
    const allPlayersJoined = gameState.players.length === gameState.playerCount;

    return (
        <div className="w-full min-h-screen flex items-center justify-center p-4 game-background">
             <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
             >
                <UICard className="w-full max-w-lg shadow-2xl bg-card/90 backdrop-blur-sm border-black/20">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold text-primary">Game Lobby</CardTitle>
                        <CardDescription>Share the room code with your friends to join!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {roomCode && (
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <Label>Room Code</Label>
                                <div className="flex items-center gap-2">
                                    <div className="text-lg font-mono tracking-widest bg-muted p-3 rounded-lg border max-w-full overflow-x-auto">
                                        {roomCode}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={copyGameCode} aria-label="Copy code">
                                        <Copy className="w-6 h-6"/>
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-lg font-bold"><Users /> Players ({gameState.players.length}/{gameState.playerCount})</Label>
                            <div className="space-y-2 rounded-md bg-muted/80 p-3 border h-48 overflow-y-auto">
                                {gameState.players.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-background/50">
                                        <span className="font-semibold">{p.name} {p.peerId === myPeerId && '(You)'}</span>
                                        {p.isHost && <Badge>Host</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            {isHost && (
                                <Button className="w-full h-12 text-lg font-bold" onClick={onStartGame} disabled={!allPlayersJoined || isStartingGame}>
                                    {isStartingGame ? <Loader2 className="animate-spin"/> : (allPlayersJoined ? 'Start Game' : `Waiting for ${gameState.playerCount - gameState.players.length} more...`)}
                                </Button>
                            )}
                            {!isHost && <div className="w-full flex items-center justify-center text-muted-foreground p-3 bg-muted/50 rounded-md"><Loader2 className="mr-2 animate-spin"/>Waiting for the host to start...</div>}
                            <Button variant="outline" size="lg" onClick={shareGame}>
                                <Share2 className="w-5 h-5"/>
                            </Button>
                        </div>
                    </CardContent>
                </UICard>
             </motion.div>
        </div>
    )
}
