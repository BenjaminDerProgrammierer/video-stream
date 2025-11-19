'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Peer from 'simple-peer';

interface ViewerComponentProps {
  roomId: string;
}

export default function ViewerComponent({ roomId }: Readonly<ViewerComponentProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string>('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [isSignaling, setIsSignaling] = useState(false);

  const createPeerConnection = useCallback((initialSignal?: string | Peer.SignalData) => {
    if (!socket || isSignaling) return;

    try {
      setError('');
      setIsSignaling(true);
      console.log('Creating viewer peer connection as non-initiator');

      // Create peer connection as non-initiator (receiver)
      const newPeer = new Peer({
        initiator: false,
        trickle: false,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      newPeer.on('signal', (signal) => {
        console.log('Viewer sending signal to streamer:', signal);
        socket.emit('signal', { to: 'streamer', signal, room: roomId });
      });

      newPeer.on('stream', (remoteStream: MediaStream) => {
        console.log('Viewer received stream:', remoteStream);
        setStream(remoteStream);
        setIsConnected(true);

        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
      });

      newPeer.on('connect', () => {
        console.log('Viewer connected to streamer');
      });

      newPeer.on('error', (err: Error) => {
        console.error('Viewer peer connection error:', err);
        setError('Failed to connect to stream');
        setIsConnected(false);
      });

      newPeer.on('close', () => {
        console.log('Viewer peer connection closed');
      });

      // Monitor ICE connection state
      const pc = (newPeer as unknown as { _pc: RTCPeerConnection })._pc;
      if (pc) {
        pc.addEventListener('iceconnectionstatechange', () => {
          console.log('Viewer ICE connection state:', pc.iceConnectionState);
        });

        pc.addEventListener('connectionstatechange', () => {
          console.log('Viewer connection state:', pc.connectionState);
        });
      }

      setPeer(newPeer);

      // If we received an initial signal, handle it
      if (initialSignal) {
        setTimeout(() => {
          if (!newPeer.destroyed) {
            console.log('Processing initial signal');
            newPeer.signal(initialSignal);
          }
        }, 100);
      }

    } catch (err) {
      console.error('Error creating peer connection:', err);
      setError('Failed to connect to stream');
      setIsSignaling(false);
    }
  }, [socket, roomId, isSignaling]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io({ path: '/api/socket' });
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Handle socket events when socket or peer changes
  useEffect(() => {
    if (!socket) return;

    const handleStreamerSignal = (signal: string | Peer.SignalData) => {
      console.log('Viewer received signal from streamer:', signal);
      if (peer && !peer.destroyed) {
        console.log('Signaling existing peer connection');
        try {
          peer.signal(signal);
        } catch (err) {
          console.error('Error signaling existing peer:', err);
        }
      } else if (!peer) {
        console.log('Creating new peer connection with initial signal');
        // Create peer connection when receiving signal from streamer
        createPeerConnection(signal);
      } else {
        console.warn('Ignoring signal for destroyed peer');
      }
    };

    const handleStreamerDisconnected = () => {
      setIsConnected(false);
      setStream(null);
      setIsSignaling(false);
      if (peer) {
        peer.destroy();
        setPeer(null);
      }
    };

    socket.on('streamer-signal', handleStreamerSignal);
    socket.on('streamer-disconnected', handleStreamerDisconnected);

    return () => {
      socket.off('streamer-signal', handleStreamerSignal);
      socket.off('streamer-disconnected', handleStreamerDisconnected);
      if (peer) {
        peer.destroy();
      }
    };
  }, [socket, peer, createPeerConnection]);

  const connectToStream = () => {
    if (!socket || isSignaling) return;

    try {
      setError('');
      
      // Clean up any existing peer connection first
      if (peer) {
        peer.destroy();
        setPeer(null);
      }
      
      // Join room as viewer - peer connection will be created when streamer sends signal
      socket.emit('join-room', { roomId, role: 'viewer' });

    } catch (err) {
      console.error('Error connecting to stream:', err);
      setError('Failed to connect to stream');
    }
  };

  const disconnect = () => {
    if (peer) {
      peer.destroy();
      setPeer(null);
    }

    if (socket) {
      socket.emit('leave-room', roomId);
    }

    setIsConnected(false);
    setStream(null);
    setIsSignaling(false);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (!isFullscreen) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">
          Watch Stream
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video mb-4 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls={isConnected}
            className="w-full h-full object-contain"
          />

          {!isConnected && !stream && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <div className="text-6xl mb-4">📺</div>
                <p>No stream available</p>
                <p className="text-sm text-gray-300">Connect to watch the stream</p>
              </div>
            </div>
          )}

          {isConnected && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-opacity"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="text-center mb-4">
          <p className="text-sm text-gray-600">
            Room ID: <span className="font-mono font-bold">{roomId}</span>
          </p>
          <p className="text-sm text-gray-600">
            Status: <span className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
        </div>

        <div className="flex justify-center gap-3">
          {!isConnected ? (
            <button
              onClick={connectToStream}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Connect to Stream
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}