
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Peer, DataConnection } from 'peerjs';
import { type GameState, type Player } from '@/lib/game';
import { useToast } from './use-toast';
import { createRoom, getRoomPeerId } from '@/lib/roomCodeService';

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
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [role, setRole] = useState<PlayerRole>('none');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const { toast } = useToast();

    // Refs for PeerJS instance and current game state to avoid stale closures
    const peerRef = useRef<Peer | null>(null);
    const gameStateRef = useRef(gameState);
    const connectionsRef = useRef<Record<string, DataConnection>>({});

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

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

            // Explicitly configure the public PeerJS server for better reliability on Vercel
            const newPeer = new Peer({
                host: 'peerjs.replit.com',
                path: '/',
                port: 443,
                secure: true,
                debug: 2
            });

            peerRef.current = newPeer;
            setStatus('connecting');

            newPeer.on('open', (id) => {
                setMyPeerId(id);
                setStatus('connected');
                console.log('My peer ID is: ' + id);
            });

            newPeer.on('connection', (conn) => {
                console.log(`Incoming connection from ${conn.peer}`);
                connectionsRef.current[conn.peer] = conn;
                conn.on('open', () => {
                    conn.on('data', (data) => handleIncomingMessage(data as Message, conn.peer));
                    conn.on('close', () => {
                         console.log(`Connection closed from ${conn.peer}`);
                         if (role === 'host' && gameStateRef.current) {
                            const newPlayers = gameStateRef.current.players.filter(p => p.peerId !== conn.peer);
                            if (newPlayers.length < gameStateRef.current.players.length) {
                                const newGameState = {
                                    ...gameStateRef.current,
                                    players: newPlayers,
                                    turnHistory: [...gameStateRef.current.turnHistory, `A player has disconnected.`]
                                };
                                broadcastGameState(newGameState);
                            }
                         }
                         delete connectionsRef.current[conn.peer];
                    });
                });
            });

            newPeer.on('error', (err: any) => {
                console.error('PeerJS error:', err);
                if (err.type === 'peer-unavailable') {
                    toast({ variant: 'destructive', title: 'Could Not Join', description: 'The host is not available. Please check the game code and try again.' });
                    setRole('none');
                    setGameState(null);
                } else {
                    toast({ variant: 'destructive', title: 'Connection Error', description: 'A network error occurred.' });
                }
                setStatus('error');
            });
        });
    }, [toast, role]);

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
            const roomCode = await createRoom(myPeerId);
            setRole('host');
            setGameState({ ...initialState, id: roomCode, hostPeerId: myPeerId });
        } catch (error) {
            console.error("Failed to create room:", error);
            toast({ variant: 'destructive', title: 'Service Error', description: 'Could not create a game room. The service might be temporarily down. Please try again later.' });
        }
    };

    const joinGame = async (roomCode: string) => {
        if (!peerRef.current || !myPeerId) {
            toast({ variant: 'destructive', title: 'Connection not ready', description: 'Please wait a moment and try again.'});
            return;
        }
        
        try {
            const hostPeerId = await getRoomPeerId(roomCode);
            if (!hostPeerId) {
                toast({ variant: 'destructive', title: 'Invalid Game Code', description: 'No game found for that code.' });
                return;
            }

            console.log(`Attempting to connect to host: ${hostPeerId}`);
            const conn = peerRef.current.connect(hostPeerId, { reliable: true });
            setRole('peer');

            conn.on('open', () => {
                connectionsRef.current[hostPeerId] = conn;
                console.log(`Connection opened to host ${hostPeerId}`);
                conn.send({ type: 'player_join_request', payload: { peerId: myPeerId, playerName: localPlayerName } });
            });
            
            conn.on('data', (data) => handleIncomingMessage(data as Message, hostPeerId));

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                toast({ variant: 'destructive', title: 'Failed to Join', description: 'Could not connect to the host.' });
                setRole('none');
            });

        } catch (error) {
            console.error("Failed to get room peer ID:", error);
            toast({ variant: 'destructive', title: 'Service Error', description: 'Could not look up the game room. The service might be temporarily down.' });
        }
    };
    
    const broadcastGameState = (newState: GameState) => {
        if (role !== 'host') return;
        console.log("Host broadcasting state:", newState);
        setGameState(newState); // Host updates its own state immediately
        
        // Broadcast to all connected peers
        Object.values(connectionsRef.current).forEach(conn => {
            if (conn && conn.open) {
                // Find the player associated with this connection
                const player = newState.players.find(p => p.peerId === conn.peer);
                // If the player is still in the game, send the update
                if (player) {
                    conn.send({ type: 'game_state_update', payload: newState });
                }
            }
        });
    };
    
    return { myPeerId, status, role, gameState, hostGame, joinGame, broadcastGameState };
};
