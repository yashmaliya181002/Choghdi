'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { SpadeIcon, HeartIcon, DiamondIcon, ClubIcon } from '@/components/game/SuitIcons';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleCreateGame = () => {
    if (!playerName.trim()) {
      toast({ variant: 'destructive', title: 'Please enter your name.' });
      return;
    }
    setIsLoading(true);
    // Generate a unique ID for the game room.
    const gameId = Math.random().toString(36).substring(2, 8);
    // Store player info to pass to the next page.
    // This is a simple way; a real app might use a global state manager.
    sessionStorage.setItem('playerName', playerName);
    sessionStorage.setItem('playerCount', String(playerCount));
    sessionStorage.setItem('isHost', 'true');

    router.push(`/game/${gameId}`);
  };

  return (
    <div className="min-h-screen game-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <SpadeIcon className="absolute -bottom-12 -left-12 text-black/5 w-48 h-48 rotate-[-30deg]" />
      <HeartIcon className="absolute -top-20 -right-16 text-red-500/5 w-56 h-56 rotate-[20deg]" />
      <ClubIcon className="absolute bottom-24 right-10 text-black/5 w-32 h-32 rotate-[15deg]" />
      <DiamondIcon className="absolute top-24 left-10 text-red-500/5 w-24 h-24 rotate-[15deg]" />

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
            <motion.div key="main" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="player-name">Your Name</Label>
                <Input id="player-name" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
              </div>
              
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
                    <Button className="w-full h-10" onClick={handleCreateGame} disabled={isLoading}>
                      {isLoading ? <Loader2 className="animate-spin" /> : 'Create Table'}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
              </div>
              
              <p className="text-center text-muted-foreground">Ask a friend for a game link to join them!</p>

            </motion.div>
          </CardContent>
        </UICard>
      </motion.div>
    </div>
  );
}
