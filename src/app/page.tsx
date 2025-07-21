
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy } from 'lucide-react';
import { SpadeIcon, HeartIcon, DiamondIcon, ClubIcon } from '@/components/game/SuitIcons';
import GameBoard from '@/components/game/GameBoard';
import Lobby from '@/components/game/Lobby';
import { useGameConnection } from '@/hooks/useGameConnection';
import type { GameState } from '@/lib/game';

type View = 'menu' | 'lobby' | 'game';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [playerCount, setPlayerCount] = useState('4');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState<View>('menu');

  const { toast } = useToast();
  const { 
    myPeerId, 
    role, 
    gameState, 
    isLoading, 
    error,
    createRoom, 
    joinRoom,
    broadcastGameState,
    isStartingGame,
    startGame,
    status
  } = useGameConnection(playerName);

  const handleCreateTable = async () => {
    if (!playerName.trim()) {
      toast({ variant: 'destructive', title: 'Please enter your name.' });
      return;
    }
    const created = await createRoom(parseInt(playerCount, 10));
    if (created) {
      setView('lobby');
    }
  };

  const handleJoinTable = async () => {
    if (!playerName.trim()) {
      toast({ variant: 'destructive', title: 'Please enter your name.' });
      return;
    }
    if (!joinCode.trim()) {
      toast({ variant: 'destructive', title: 'Please enter a valid join code.' });
      return;
    }
    const joined = await joinRoom(joinCode);
    if (joined) {
      setView('lobby');
    }
  };

  if (error) {
    toast({ variant: 'destructive', title: "Error", description: error });
  }

  if (gameState && view === 'lobby' && gameState.phase !== 'lobby') {
    setView('game');
  }

  if (view === 'lobby' && gameState) {
    return <Lobby 
      gameState={gameState} 
      myPeerId={myPeerId} 
      isHost={role === 'host'}
      onStartGame={startGame}
      isStartingGame={isStartingGame}
    />
  }

  if (view === 'game' && gameState) {
     const localPlayer = gameState.players.find(p => p.peerId === myPeerId);
     if (!localPlayer) return <div className="w-full h-screen flex items-center justify-center game-background"><Loader2 className="animate-spin mr-2" /> Waiting for game state...</div>
    return <GameBoard
      initialGameState={gameState}
      localPlayerId={localPlayer.id}
      isHost={role === 'host'}
      broadcastGameState={role === 'host' ? broadcastGameState : undefined}
    />;
  }

  const copyMyPeerId = () => {
    if (!myPeerId) return;
    navigator.clipboard.writeText(myPeerId);
    toast({ title: "Copied!", description: "Your join code has been copied." });
  }

  return (
    <div className="min-h-screen game-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <SpadeIcon className="absolute -bottom-12 -left-12 text-black/10 w-48 h-48 rotate-[-30deg]" />
      <HeartIcon className="absolute -top-20 -right-16 text-white/5 w-56 h-56 rotate-[20deg]" />
      <ClubIcon className="absolute bottom-24 right-10 text-black/10 w-32 h-32 rotate-[15deg]" />
      <DiamondIcon className="absolute top-24 left-10 text-white/5 w-24 h-24 rotate-[15deg]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <UICard className="shadow-2xl bg-card/90 backdrop-blur-sm border-black/20">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold text-primary mb-2">Kaali Teeri</CardTitle>
            <CardDescription>The classic card game, brought online.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="player-name">Your Name</Label>
                <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <h3 className="text-lg font-bold text-center text-primary">Create a New Game</h3>
                <div className="flex items-end gap-4">
                  <div className="space-y-2 flex-grow">
                    <Label htmlFor="player-count">Players</Label>
                    <Select value={playerCount} onValueChange={setPlayerCount} disabled={isLoading}>
                      <SelectTrigger id="player-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>{n} Players</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="h-10 flex-grow" onClick={handleCreateTable} disabled={isLoading || !playerName}>
                      {isLoading && role === 'host' ? <Loader2 className="animate-spin" /> : 'Create Table'}
                  </Button>
                </div>
                 {role === 'host' && myPeerId && view === 'menu' && (
                    <div className="flex flex-col items-center gap-2 pt-2">
                        <Label>Your Join Code (Share with friends)</Label>
                        <div className="flex items-center gap-2 p-2 bg-background rounded-md border w-full">
                            <Input readOnly value={myPeerId} className="border-none text-center tracking-wider"/>
                            <Button size="icon" variant="ghost" onClick={copyMyPeerId}><Copy /></Button>
                        </div>
                    </div>
                )}
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <h3 className="text-lg font-bold text-center text-primary">Join an Existing Game</h3>
                <div className="flex items-end gap-4">
                  <div className="space-y-2 flex-grow">
                    <Label htmlFor="game-code">Host's Code</Label>
                    <Input id="game-code" placeholder="Paste host's code..." value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                  </div>
                  <Button className="h-10 flex-grow" onClick={handleJoinTable} disabled={isLoading || !playerName || joinCode.length === 0}>
                    {isLoading && role === 'peer' ? <Loader2 className="animate-spin" /> : 'Join Game'}
                  </Button>
                </div>
              </div>
          </CardContent>
        </UICard>
      </motion.div>
    </div>
  );
}
