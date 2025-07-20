
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState } from '@/lib/game';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type PlayerRole = 'host' | 'peer' | 'none';

type Message = {
    type: 'game_state_update';
    payload: GameState;
} | {
    type: 'player_joined';
    payload: { peerId: string, playerName: string };
} | {
    type: 'request_initial_state';
} | {
    type: 'game_started';
    payload: GameState;
};

export const useGameConnection = (localPlayerName: string) => {
    const [peer, setPeer] = useState<Peer | null>(null);
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [connections, setConnections] = useState<Record<string, DataConnection>>({});
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [role, setRole] = useState<PlayerRole>('none');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [error, setError] = useState<string>('');

    const gameStateRef = useRef(gameState);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const initializePeer = useCallback(() => {
        if (peer) {
            peer.destroy();
        }
        
        const newPeer = new Peer();
        setPeer(newPeer);
        setStatus('connecting');

        newPeer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            setMyPeerId(id);
            setStatus('connected');
        });

        newPeer.on('connection', (conn) => {
            console.log(`Incoming connection from ${conn.peer}`);
            
            conn.on('open', () => {
                setConnections(prev => ({ ...prev, [conn.peer]: conn }));
                
                conn.on('data', (data) => {
                    handleIncomingMessage(data as Message, conn.peer);
                });
                
                conn.on('close', () => {
                    setConnections(prev => {
                        const newConns = { ...prev };
                        delete newConns[conn.peer];
                        return newConns;
                    });
                });
            });
        });

        newPeer.on('disconnected', () => {
            setStatus('disconnected');
            setTimeout(() => newPeer.reconnect(), 3000);
        });

        newPeer.on('error', (err) => {
            console.error(err);
            setError(err.message);
            setStatus('error');
        });

        return newPeer;
    }, [peer]);

    useEffect(() => {
        const p = initializePeer();
        return () => {
            p?.destroy();
        };
    }, []);

    const handleIncomingMessage = (message: Message, peerId: string) => {
        console.log('Received message:', message);
        switch (message.type) {
            case 'game_state_update':
                setGameState(message.payload);
                break;
            case 'request_initial_state':
                if (role === 'host' && gameStateRef.current) {
                    const conn = connections[peerId];
                    if (conn) {
                         conn.send({ type: 'game_state_update', payload: gameStateRef.current });
                    }
                }
                break;
            case 'player_joined': 
                 if (role === 'host') {
                    // Host logic to add player
                 }
                 break;
            case 'game_started':
                if (role === 'peer') {
                    setGameState(message.payload);
                }
                break;
        }
    };
    
    const hostGame = (initialGameState: GameState) => {
        setRole('host');
        setGameState(initialGameState);
    };

    const joinGame = (hostPeerId: string) => {
        if (!peer) {
            setError('Peer not initialized');
            return;
        }
        
        const conn = peer.connect(hostPeerId);
        setRole('peer');
        setStatus('connecting');
        
        conn.on('open', () => {
            console.log(`Connected to host ${hostPeerId}`);
            setConnections(prev => ({ ...prev, [hostPeerId]: conn }));
            setStatus('connected');
            conn.send({ type: 'request_initial_state' });
        });

        conn.on('data', (data) => {
            handleIncomingMessage(data as Message, hostPeerId);
        });

        conn.on('error', (err) => {
            setError(`Connection error: ${err.message}`);
            setStatus('error');
        });
    };
    
    const broadcastGameState = (newState: GameState) => {
        if (role !== 'host') return;
        setGameState(newState);
        console.log("Broadcasting state to all peers:", newState);
        Object.values(connections).forEach(conn => {
            conn.send({ type: 'game_state_update', payload: newState });
        });
    };
    
    const updateGameState = (newState: GameState) => {
       if (role === 'host') {
           broadcastGameState(newState);
       } else {
           setGameState(newState); // Optimistic update for peer
       }
    };

    return { myPeerId, status, role, gameState, error, hostGame, joinGame, updateGameState, broadcastGameState };
};
