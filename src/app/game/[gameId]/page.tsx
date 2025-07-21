'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Lobby from '@/components/game/Lobby';
import { Loader2 } from 'lucide-react';

export default function GamePage() {
    const params = useParams();
    const router = useRouter();
    const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
    const [isReady, setIsReady] = useState(false);
    const [initialPlayerName, setInitialPlayerName] = useState('');
    const [initialPlayerCount, setInitialPlayerCount] = useState<number | undefined>(undefined);
    const [isHost, setIsHost] = useState(false);

    useEffect(() => {
        // This effect runs on the client after the component mounts.
        // It retrieves player info from sessionStorage.
        // This is a simple way to pass info from the creation page to the game page.
        const name = sessionStorage.getItem('playerName');
        const count = sessionStorage.getItem('playerCount');
        const host = sessionStorage.getItem('isHost');
        
        if (!name) {
            // If there's no name, they probably landed here from a link.
            // We can add a pre-lobby screen later to ask for their name.
            // For now, redirect to home to enter a name.
            const prefilledName = prompt("Please enter your name to join the game:");
            if (prefilledName) {
                sessionStorage.setItem('playerName', prefilledName);
                router.refresh(); // Refresh to re-run the effect with the new name
            } else {
                alert("You must enter a name to join.");
                router.push('/');
            }
            return;
        }

        setInitialPlayerName(name);
        
        if (host === 'true' && count) {
            // This person created the game.
            setIsHost(true);
            setInitialPlayerCount(parseInt(count, 10));
        }

        // Clean up sessionStorage so these values aren't accidentally reused.
        sessionStorage.removeItem('playerCount');
        sessionStorage.removeItem('isHost');

        setIsReady(true);
        
    }, [router]);

    if (!isReady || !gameId) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center game-background text-foreground">
                <Loader2 className="animate-spin mr-2 h-8 w-8" />
                <p className="mt-2 text-lg">Entering Game Room...</p>
            </div>
        );
    }
    
    return (
        <main className="min-h-screen game-background text-foreground">
            <Lobby
                gameId={gameId}
                initialPlayerName={initialPlayerName}
                initialPlayerCount={initialPlayerCount}
                isHost={isHost}
            />
        </main>
    );
}
