'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Peer, DataConnection } from 'peerjs';
import { type GameState, type Player } from '@/lib/game';
import { useToast } from './use-toast';
import { useRouter } from 'next/navigation';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type PlayerRole = 'host' | 'peer' | 'none';

type Message = {
    type: 'game_state_update';
    payload: GameState;
} | {
    type: 'player_join_request';
    payload: { peerId: string, playerName: string };
} | {
    type: 'game_full';
} | {
    type: 'player_left';
    payload: { peerId: string };
};

export const useGameConnection = (localPlayerName: string, gameId: string) => {
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [connections, setConnections] = useState<Record<string, DataConnection>>({});
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [role, setRole] = useState<PlayerRole>('none');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const peerRef = useRef<Peer | null>(null);
    const hostPeerIdRef = useRef<string | null>(null); // For peers, to know who the host is
    const gameStateRef = useRef(gameState);
    const connectionsRef = useRef(connections);

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { connectionsRef.current = connections; }, [connections]);
    
    const broadcastGameState = useCallback((newState: GameState) => {
        if (role !== 'host') return;
        console.log("Host broadcasting new state:", newState);
        const message: Message = { type: 'game_state_update', payload: newState };
        
        Object.values(connectionsRef.current).forEach(conn => {
            if (conn && conn.open) {
                conn.send(message);
            }
        });
        // The host also updates its own state
        setGameState(newState);
    }, [role]);

    const handleIncomingMessage = useCallback((message: Message, fromPeerId: string) => {
        console.log('Received message:', message.type, 'from', fromPeerId);
        switch (message.type) {
            case 'game_state_update':
                if (role === 'peer') {
                    setGameState(message.payload);
                }
                break;
            case 'player_join_request':
                if (role === 'host' && gameStateRef.current) {
                    const currentGameState = gameStateRef.current;
                    if (currentGameState.players.length >= currentGameState.playerCount) {
                        const gameFullMessage: Message = { type: 'game_full' };
                        const conn = peerRef.current?.connect(fromPeerId);
                        if(conn){
                            conn.on('open', () => {
                                conn.send(gameFullMessage);
                                setTimeout(() => conn.close(), 500);
                            });
                        }
                        return;
                    }

                    const newPlayer: Player = {
                        id: currentGameState.players.length,
                        peerId: message.payload.peerId,
                        name: message.payload.playerName,
                        hand: [], isBidder: false, isPartner: false, collectedCards: [], tricksWon: 0
                    };
                    
                    const newGameState = {
                        ...currentGameState,
                        players: [...currentGameState.players, newPlayer],
                        turnHistory: [...currentGameState.turnHistory, `${newPlayer.name} has joined.`]
                    };
                    
                    broadcastGameState(newGameState);
                }
                break;
            case 'game_full':
                toast({ variant: 'destructive', title: 'Game is full', description: 'Could not join because the table is full.' });
                router.push('/');
                break;
            case 'player_left':
                if (role === 'host' && gameStateRef.current) {
                    const leavingPlayer = gameStateRef.current.players.find(p => p.peerId === message.payload.peerId);
                    if (leavingPlayer) {
                        const newGameState = {
                            ...gameStateRef.current,
                            players: gameStateRef.current.players.filter(p => p.peerId !== message.payload.peerId),
                            turnHistory: [...gameStateRef.current.turnHistory, `${leavingPlayer.name} has left.`]
                        };
                        toast({title: "Player Left", description: `${leavingPlayer.name} has left the game.`});
                        broadcastGameState(newGameState);
                    }
                }
                break;
        }
    }, [role, toast, broadcastGameState, router]);
    
    const initializePeer = useCallback(() => {
        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) return;

            const peerIdForRoom = role === 'host' ? gameId : undefined;

            const newPeer = new Peer(peerIdForRoom, {
                host: 'peerjs.92k.de',
                secure: true,
                port: 443,
            });
            peerRef.current = newPeer;
            setStatus('connecting');

            newPeer.on('open', (id) => {
                setMyPeerId(id);
                setStatus('connected');
                console.log('PeerJS connection open. My ID:', id);
            });

            newPeer.on('connection', (conn) => {
                conn.on('open', () => {
                    console.log('New connection from', conn.peer);
                    setConnections(prev => ({ ...prev, [conn.peer]: conn }));
                    
                    conn.on('data', (data) => handleIncomingMessage(data as Message, conn.peer));
                    
                    conn.on('close', () => {
                        console.log('Connection closed from', conn.peer);
                        handleIncomingMessage({ type: 'player_left', payload: { peerId: conn.peer } }, 'system');
                        setConnections(prev => {
                            const newConns = { ...prev };
                            delete newConns[conn.peer];
                            return newConns;
                        });
                    });
                });
            });

            newPeer.on('error', (err) => {
                console.error('PeerJS error:', err);
                toast({ variant: 'destructive', title: 'Connection Error', description: `An unexpected network error occurred: ${err.message}` });
                setStatus('error');
                router.push('/');
            });
        });
    }, [toast, gameId, role, router, handleIncomingMessage]);

    useEffect(() => {
        if (!localPlayerName || !gameId) return;
        initializePeer();
        return () => {
            peerRef.current?.destroy();
        };
    }, [initializePeer, localPlayerName, gameId]);
    
    const hostGame = useCallback((initialState: GameState) => {
        setRole('host');
        setGameState(initialState);
    }, []);

    const joinGame = useCallback(() => {
        if (!peerRef.current || !myPeerId) {
            console.error("joinGame called before PeerJS is ready.");
            return;
        }
        setRole('peer');
        hostPeerIdRef.current = gameId; // The gameId is the host's PeerJS ID
        
        const conn = peerRef.current.connect(gameId);

        conn.on('open', () => {
            console.log("Connection to host established.");
            setConnections({ [gameId]: conn });
            
            const requestMessage: Message = { type: 'player_join_request', payload: { peerId: myPeerId, playerName: localPlayerName } };
            conn.send(requestMessage);
            
            conn.on('data', (data) => handleIncomingMessage(data as Message, gameId));

            conn.on('close', () => {
                toast({title: "Host Disconnected", description: "The host has left the game."});
                setGameState(null);
                setRole('none');
                setConnections({});
                router.push('/');
            });
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            toast({ variant: 'destructive', title: 'Failed to Join', description: 'Could not connect to the host. The game may no longer exist.' });
            setRole('none');
            router.push('/');
        });
    }, [myPeerId, gameId, localPlayerName, handleIncomingMessage, toast, router]);
    
    return { myPeerId, status, role, gameState, hostGame, joinGame, broadcastGameState };
};
