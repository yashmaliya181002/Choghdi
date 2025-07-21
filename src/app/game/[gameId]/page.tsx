
'use client';
import Lobby from '@/components/game/Lobby';
import { Loader2 } from 'lucide-react';

export default function GamePage() {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center game-background text-foreground">
            <Loader2 className="animate-spin mr-2 h-8 w-8" />
            <p className="mt-2 text-lg">Loading Game...</p>
            <p className="text-sm text-muted-foreground">If you are trying to join a game, please use the code on the main page.</p>
        </div>
    );
}
