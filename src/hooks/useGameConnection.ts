
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Peer, DataConnection } from 'peerjs';
import { type GameState, type Player, createDeck, dealCards } from '@/lib/game';
import { createRoomCode, getRoomPeerId } from '@/lib/roomCodeService';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type PlayerRole = 'host' | 'peer' | 'none';

type Message = {
    type: 'game_state_update';
    payload: GameState;
} | {
    type: 'player_join_request';
    payload: { peerId: string, playerName: string, isHost: boolean };
} | {
    type: 'game_full';
} | {
    type: 'player_left';
    payload: { peerId: string };
};

export const useGameConnection = () => {
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [connections, setConnections] = useState<Record<string, DataConnection>>({});
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [role, setRole] = useState<PlayerRole>('none');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isStartingGame, setIsStartingGame] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        setGameState(newState);
    }, [role]);

    const handleIncomingMessage = useCallback((message: Message, fromPeerId: string) => {
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
                        hand: [], 
                        isBidder: false, isPartner: false, collectedCards: [], tricksWon: 0,
                        isHost: message.payload.isHost,
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
                setError('Game is full');
                setIsLoading(false);
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
                        broadcastGameState(newGameState);
                    }
                }
                break;
        }
    }, [role, broadcastGameState]);
    
    const initializeConnection = useCallback((name: string) => {
      setError(null);
      setIsLoading(true);
      return new Promise<string>((resolve, reject) => {
        if (peerRef.current && peerRef.current.id && !peerRef.current.disconnected) {
          setIsLoading(false);
          resolve(peerRef.current.id);
          return;
        }

        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }

            const newPeer = new Peer({
                host: 'peerjs.92k.de',
                secure: true,
                key: 'peerjs',
            });
            peerRef.current = newPeer;
            setStatus('connecting');

            newPeer.on('open', (id) => {
                setMyPeerId(id);
                setStatus('connected');
                setIsLoading(false);

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
                resolve(id);
            });

            newPeer.on('error', (err) => {
                setError(`A network error occurred: ${err.type}. Please refresh and try again.`);
                setStatus('error');
                setIsLoading(false);
                reject(err);
            });
        }).catch(err => {
            setError("Failed to load P2P library.");
            setIsLoading(false);
            reject(err);
        });
      });
    }, [handleIncomingMessage]);

    useEffect(() => {
        return () => {
            peerRef.current?.destroy();
        };
    }, []);

    const createRoom = async (playerCount: number, playerName: string) => {
        if (!peerRef.current || !peerRef.current.id) {
            setError("Connection not initialized.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setRole('host');
        try {
            const roomCode = await createRoomCode(peerRef.current.id);
            if (!roomCode) throw new Error("Could not create room code.");

            const hostPlayer: Player = {
                id: 0, name: playerName, peerId: peerRef.current.id, hand: [], isBidder: false, isPartner: false, collectedCards: [], tricksWon: 0, isHost: true
            };
            
            const initialGameState: GameState = {
                id: roomCode, // The 4-digit code is the game ID now
                phase: 'lobby',
                playerCount: playerCount,
                players: [hostPlayer],
                deck: createDeck(),
                bids: [],
                highestBid: null,
                trumpSuit: null,
                partnerCards: [],
                currentPlayerId: 0,
                currentTrick: { cards: [], leadingSuit: null },
                tricksPlayed: 0,
                team1Score: 0,
                team2Score: 0,
                turnHistory: [`Game created by ${playerName}`],
            };
            setGameState(initialGameState);
            setIsLoading(false);

        } catch (err: any) {
            setError(err.message || "Couldn't create room. Please try again.");
            setRole('none');
            setIsLoading(false);
        }
    };
    
    const joinRoom = async (roomCode: string, myPlayerName: string) => {
        if (!peerRef.current || !peerRef.current.id) {
            setError("Connection not initialized.");
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            const hostPeerId = await getRoomPeerId(roomCode);
            if (!hostPeerId) {
                throw new Error("Room code not found or expired.");
            }
            
            setRole('peer');
            const conn = peerRef.current.connect(hostPeerId, { reliable: true });
    
            conn.on('open', () => {
                setConnections({ [hostPeerId]: conn });
                
                const requestMessage: Message = { type: 'player_join_request', payload: { peerId: peerRef.current!.id, playerName: myPlayerName, isHost: false } };
                conn.send(requestMessage);
                
                conn.on('data', (data) => handleIncomingMessage(data as Message, hostPeerId));
                
                conn.on('close', () => {
                    setError("Host disconnected.");
                    setGameState(null);
                    setRole('none');
                    setConnections({});
                });
                setIsLoading(false);
            });
    
            conn.on('error', (err) => {
                setError("Failed to connect to host. Check the code and try again.");
                setRole('none');
                setConnections({});
                setIsLoading(false);
            });

        } catch (err: any) {
             setError(err.message || 'Failed to join the room. Check the code and try again.');
             setRole('none');
             setIsLoading(false);
        }
    };

    const startGame = () => {
        if (role !== 'host' || !gameState) return;
        setIsStartingGame(true);

        let updatedState = JSON.parse(JSON.stringify(gameState));
        
        const dealtPlayers = dealCards(updatedState.deck, updatedState.players);
        updatedState.players = dealtPlayers;
        updatedState.phase = 'bidding';
        updatedState.turnHistory.push(`The game has started!`);
        
        broadcastGameState(updatedState);
        setIsStartingGame(false);
    }
    
    return { myPeerId, status, role, gameState, isLoading, isStartingGame, error, createRoom, joinRoom, broadcastGameState, startGame, initializeConnection };
};
