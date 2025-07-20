
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Peer, DataConnection } from 'peerjs';
import { type GameState, type Player } from '@/lib/game';
import { useToast } from './use-toast';
import { createRoom, getPeerIdFromCode } from '@/lib/roomCodeService';

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
    type: 'welcome';
    payload: GameState;
};

export const useGameConnection = (localPlayerName: string) => {
    const [peer, setPeer] = useState<Peer | null>(null);
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [connections, setConnections] = useState<Record<string, DataConnection>>({});
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [role, setRole] = useState<PlayerRole>('none');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const { toast } = useToast();

    // Refs for PeerJS instance and current game state to avoid stale closures
    const peerRef = useRef<Peer | null>(null);
    const gameStateRef = useRef(gameState);
    const connectionsRef = useRef(connections);

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { connectionsRef.current = connections; }, [connections]);

    const handleIncomingMessage = (message: Message, fromPeerId: string) => {
        console.log('Received message:', message.type, 'from', fromPeerId);
        switch (message.type) {
            case 'game_state_update':
                // Only peers should accept state updates from the host
                if (role === 'peer') {
                    setGameState(message.payload);
                }
                break;
            case 'player_join_request':
                if (role === 'host' && gameStateRef.current) {
                    const currentGameState = gameStateRef.current;
                    if (currentGameState.players.length >= currentGameState.playerCount) {
                        connectionsRef.current[fromPeerId]?.send({ type: 'game_full' });
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

                    setGameState(newGameState);

                    // Welcome the new player with the full state
                    connectionsRef.current[fromPeerId]?.send({ type: 'welcome', payload: newGameState });
                    
                    // Notify all other players
                    broadcastGameState(newGameState);
                }
                break;
            case 'welcome':
                // For a peer who has just joined
                setGameState(message.payload);
                break;
            case 'game_full':
                toast({ variant: 'destructive', title: 'Game is full', description: 'Could not join the game because it is full.' });
                setRole('none');
                break;
        }
    };

    const initializePeer = useCallback(() => {
        // Dynamically import PeerJS only on the client side
        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }

            const newPeer = new Peer();
            peerRef.current = newPeer;
            setPeer(newPeer);
            setStatus('connecting');

            newPeer.on('open', (id) => {
                setMyPeerId(id);
                setStatus('connected');
                console.log('My peer ID is: ' + id);
            });

            newPeer.on('connection', (conn) => {
                console.log(`Incoming connection from ${conn.peer}`);
                conn.on('open', () => {
                    setConnections(prev => ({ ...prev, [conn.peer]: conn }));
                    conn.on('data', (data) => handleIncomingMessage(data as Message, conn.peer));
                    conn.on('close', () => {
                         console.log(`Connection closed from ${conn.peer}`);
                        // Handle player leaving if necessary
                    });
                });
            });

            newPeer.on('error', (err) => {
                console.error('PeerJS error:', err);
                toast({ variant: 'destructive', title: 'Connection Error', description: err.message });
                setStatus('error');
            });
        });
    }, [toast]);

    useEffect(() => {
        initializePeer();
        return () => {
            peerRef.current?.destroy();
        };
    }, [initializePeer]);
    
    const hostGame = async (initialState: GameState) => {
        if (!myPeerId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not get a peer ID to host.'});
            return;
        }
        
        try {
            const { code } = await createRoom(myPeerId);
            setRole('host');
            setGameState({ ...initialState, id: code });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error creating room', description: error.message });
        }
    };

    const joinGame = async (gameCode: string) => {
        if (!peerRef.current || !myPeerId) {
            toast({ variant: 'destructive', title: 'Connection not ready', description: 'Please wait a moment and try again.'});
            return;
        }
        
        try {
            const { peerId: hostPeerId } = await getPeerIdFromCode(gameCode);
            if (!hostPeerId) {
                toast({ variant: 'destructive', title: 'Game not found', description: 'The game code is invalid or has expired.'});
                return;
            }

            const conn = peerRef.current.connect(hostPeerId);
            setRole('peer');

            conn.on('open', () => {
                setConnections({ [hostPeerId]: conn });
                console.log(`Connection opened to host ${hostPeerId}`);
                // Announce presence to host
                conn.send({ type: 'player_join_request', payload: { peerId: myPeerId, playerName: localPlayerName } });
            });
            
            conn.on('data', (data) => handleIncomingMessage(data as Message, hostPeerId));

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                toast({ variant: 'destructive', title: 'Failed to Join', description: 'Could not connect to the host.' });
                setRole('none');
            });

        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error joining game', description: error.message });
        }
    };
    
    const broadcastGameState = (newState: GameState) => {
        if (role !== 'host') return;
        console.log("Host broadcasting state:", newState);
        Object.values(connectionsRef.current).forEach(conn => {
            if (conn && conn.open) {
                conn.send({ type: 'game_state_update', payload: newState });
            }
        });
        // The host also updates its own state
        setGameState(newState);
    };
    
    return { myPeerId, status, role, gameState, hostGame, joinGame, broadcastGameState };
};
