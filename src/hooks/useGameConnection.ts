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
} | {
    type: 'player_left';
    payload: { peerId: string };
};

export const useGameConnection = (localPlayerName: string) => {
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [connections, setConnections] = useState<Record<string, DataConnection>>({});
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [role, setRole] = useState<PlayerRole>('none');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const { toast } = useToast();

    const peerRef = useRef<Peer | null>(null);
    const gameStateRef = useRef(gameState);
    const connectionsRef = useRef(connections);

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { connectionsRef.current = connections; }, [connections]);
    
    const broadcastGameState = useCallback((newState: GameState) => {
        if (role !== 'host') return;

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
                        // Need to establish connection to send a message back
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
            case 'welcome':
                // This is now handled by the general 'game_state_update' broadcast
                setGameState(message.payload);
                break;
            case 'game_full':
                toast({ variant: 'destructive', title: 'Game is full', description: 'Could not join the game because it is full.' });
                setRole('none');
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
    }, [role, toast, broadcastGameState]);
    
    const initializePeer = useCallback(() => {
        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) return;

            // Using a specific, reliable public PeerJS server
            const newPeer = new Peer({
                host: 'peerjs.92k.de',
                secure: true,
                port: 443,
            });
            peerRef.current = newPeer;
            setStatus('connecting');

            newPeer.on('open', (id) => {
                setMyPeerId(id);
                setStatus('connected');
            });

            newPeer.on('connection', (conn) => {
                conn.on('open', () => {
                    setConnections(prev => ({ ...prev, [conn.peer]: conn }));
                    
                    conn.on('data', (data) => handleIncomingMessage(data as Message, conn.peer));
                    
                    conn.on('close', () => {
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
                if (String(err).includes('Could not connect to peer')) {
                     toast({ variant: 'destructive', title: 'Host Unavailable', description: 'Could not connect to the host. The code might be wrong or the game has ended.' });
                } else if (err.type === 'peer-unavailable') {
                    toast({ variant: 'destructive', title: 'Game Not Found', description: 'The 4-digit code is incorrect or has expired.'})
                } else {
                     toast({ variant: 'destructive', title: 'Connection Error', description: `An unexpected network error occurred: ${err.message}` });
                }
                setStatus('error');
            });
        });
    }, [toast, handleIncomingMessage]);

    useEffect(() => {
        initializePeer();
        return () => {
            peerRef.current?.destroy();
        };
    }, [initializePeer]);
    
    const hostGame = async (initialState: GameState) => {
        if (status !== 'connected' || !myPeerId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Not connected to the server yet. Please wait a moment.'});
            return;
        }
        
        try {
            const code = await createRoom(myPeerId);
            setRole('host');
            setGameState({ ...initialState, id: code });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Creating Room', description: error.message });
        }
    };

    const joinGame = async (gameCode: string) => {
        if (status !== 'connected' || !peerRef.current || !myPeerId) {
            toast({ variant: 'destructive', title: 'Connection not ready', description: 'Please wait a moment and try again.'});
            return;
        }
        
        try {
            const hostPeerId = await getPeerIdFromCode(gameCode);
            if (!hostPeerId) {
                toast({ variant: 'destructive', title: 'Game Not Found', description: 'The game code is invalid or has expired.'});
                return;
            }

            if (hostPeerId === myPeerId) {
                toast({ variant: 'destructive', title: 'Error', description: "You can't join your own game."});
                return;
            }

            const conn = peerRef.current.connect(hostPeerId);
            setRole('peer');

            conn.on('open', () => {
                setConnections({ [hostPeerId]: conn });
                
                // Welcome message is now sent as a direct game_state_update broadcast
                const requestMessage: Message = { type: 'player_join_request', payload: { peerId: myPeerId, playerName: localPlayerName } };
                conn.send(requestMessage);
                
                conn.on('data', (data) => handleIncomingMessage(data as Message, hostPeerId));

                 conn.on('close', () => {
                    toast({title: "Host Disconnected", description: "The host has left the game."});
                    setGameState(null);
                    setRole('none');
                    setConnections({});
                });
            });

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                toast({ variant: 'destructive', title: 'Failed to Join', description: 'Could not connect to the host.' });
                setRole('none');
            });

        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error Joining Room', description: error.message });
        }
    };
    
    return { myPeerId, status, role, gameState, hostGame, joinGame, broadcastGameState };
};
