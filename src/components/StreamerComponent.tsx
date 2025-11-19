'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Peer from 'simple-peer';

interface StreamerComponentProps {
  roomId: string;
}

export default function StreamerComponent({ roomId }: Readonly<StreamerComponentProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');
  const [connectedViewers, setConnectedViewers] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const peers = useRef<{ [key: string]: Peer.Instance }>({});
  
  // Device selection state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');

  const createPeerConnection = useCallback((viewerId: string, initiator: boolean, socket: Socket) => {
    console.log('Creating peer connection for viewer:', viewerId, 'as initiator:', initiator, 'with stream:', !!stream);
    
    // Clean up any existing peer connection first
    if (peers.current[viewerId]) {
      console.log('Cleaning up existing peer for viewer:', viewerId);
      peers.current[viewerId].destroy();
      delete peers.current[viewerId];
    }
    
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      console.log('Streamer sending signal to viewer:', viewerId, signal);
      socket.emit('signal', { to: viewerId, signal, room: roomId });
    });

    peer.on('connect', () => {
      console.log('Streamer connected to viewer:', viewerId);
      setConnectedViewers(prev => prev + 1);
    });

    peer.on('error', (err) => {
      console.error('Streamer peer connection error with viewer', viewerId, ':', err);
      setError('Connection error with viewer');
    });

    peer.on('close', () => {
      console.log('Streamer peer connection closed with viewer:', viewerId);
    });

    // Monitor ICE connection state
    const pc = (peer as unknown as { _pc: RTCPeerConnection })._pc;
    if (pc) {
      pc.addEventListener('iceconnectionstatechange', () => {
        console.log('Streamer ICE connection state with viewer', viewerId, ':', pc.iceConnectionState);
      });

      pc.addEventListener('connectionstatechange', () => {
        console.log('Streamer connection state with viewer', viewerId, ':', pc.connectionState);
      });
    }

    peers.current[viewerId] = peer;
  }, [stream, roomId]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io({ path: '/api/socket' });
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Enumerate media devices on component mount
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permissions first
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        setVideoDevices(videoInputs);
        setAudioDevices(audioInputs);
        
        // Set default devices
        if (videoInputs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoInputs[0].deviceId);
        }
        if (audioInputs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error('Error enumerating devices:', err);
      }
    };

    getDevices();
  }, [selectedVideoDevice, selectedAudioDevice]);

  // Handle socket events separately
  useEffect(() => {
    if (!socket) return;

    const handleViewerJoined = (viewerId: string) => {
      console.log('Viewer joined:', viewerId, 'Stream available:', !!stream);
      
      // Prevent duplicate peer connections
      if (peers.current[viewerId]) {
        console.log('Peer connection already exists for viewer:', viewerId);
        return;
      }
      
      if (stream && socket) {
        createPeerConnection(viewerId, true, socket);
      } else {
        console.warn('Cannot create peer connection - missing stream or socket');
      }
    };

    const handleSignal = (data: { from: string; signal: string | Peer.SignalData }) => {
      console.log('Streamer received signal from viewer:', data.from, typeof data.signal === 'object' ? data.signal.type : 'unknown');
      const peer = peers.current[data.from];
      if (peer && !peer.destroyed) {
        try {
          peer.signal(data.signal);
        } catch (err) {
          console.error('Error signaling peer for viewer', data.from, ':', err);
          // Clean up the broken peer connection and recreate if needed
          peer.destroy();
          delete peers.current[data.from];
          
          // If we have a stream, try to recreate the connection
          if (stream && socket) {
            console.log('Attempting to recreate peer connection for viewer:', data.from);
            setTimeout(() => {
              createPeerConnection(data.from, true, socket);
            }, 1000);
          }
        }
      } else if (!peer && stream && socket) {
        // If no peer exists but we have a stream, create one (viewer might have reconnected)
        console.log('Creating new peer connection for reconnected viewer:', data.from);
        createPeerConnection(data.from, true, socket);
        // Process the signal after a short delay
        setTimeout(() => {
          if (peers.current[data.from]) {
            peers.current[data.from].signal(data.signal);
          }
        }, 100);
      } else {
        console.error('No peer connection found for viewer:', data.from, 'and cannot create new one');
      }
    };

    const handleViewerDisconnected = (viewerId: string) => {
      if (peers.current[viewerId]) {
        peers.current[viewerId].destroy();
        delete peers.current[viewerId];
      }
      setConnectedViewers(prev => prev - 1);
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('signal', handleSignal);
    socket.on('viewer-disconnected', handleViewerDisconnected);

    return () => {
      socket.off('viewer-joined', handleViewerJoined);
      socket.off('signal', handleSignal);
      socket.off('viewer-disconnected', handleViewerDisconnected);
      Object.values(peers.current).forEach(peer => peer.destroy());
    };
  }, [socket, stream, createPeerConnection]);

  const startStreaming = async () => {
    try {
      setError('');
      
      // Request camera and microphone access with selected devices
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice ? {
          deviceId: { exact: selectedVideoDevice },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: selectedAudioDevice ? {
          deviceId: { exact: selectedAudioDevice },
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Join room as streamer
      if (socket) {
        socket.emit('join-room', { roomId, role: 'streamer' });
      }

      setIsStreaming(true);
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const stopStreaming = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    Object.values(peers.current).forEach(peer => peer.destroy());
    peers.current = {};

    if (socket) {
      socket.emit('leave-room', roomId);
    }

    setIsStreaming(false);
    setConnectedViewers(0);
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  const toggleMicrophone = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-bold text-center mb-4">
          Stream Video & Audio
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video mb-4">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        <div className="text-center mb-4">
          <p className="text-sm text-gray-600">
            Room ID: <span className="font-mono font-bold">{roomId}</span>
          </p>
          <p className="text-sm text-gray-600">
            Connected viewers: <span className="font-bold">{connectedViewers}</span>
          </p>
        </div>

        {!isStreaming && (
          <div className="space-y-4 mb-4">
            <div>
              <label htmlFor="video-select" className="block text-sm font-medium text-gray-900 mb-2">
                Camera
              </label>
              <select
                id="video-select"
                value={selectedVideoDevice}
                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="audio-select" className="block text-sm font-medium text-gray-900 mb-2">
                Microphone
              </label>
              <select
                id="audio-select"
                value={selectedAudioDevice}
                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {!isStreaming ? (
            <button
              onClick={startStreaming}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Start Streaming
            </button>
          ) : (
            <>
              <button
                onClick={stopStreaming}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Stop Streaming
              </button>
              <button
                onClick={toggleCamera}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Toggle Camera
              </button>
              <button
                onClick={toggleMicrophone}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Toggle Mic
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}