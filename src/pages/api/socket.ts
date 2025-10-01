import { NextApiRequest, NextApiResponse } from 'next';
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

interface Room {
  streamer?: string;
  viewers: Set<string>;
}

const rooms = new Map<string, Room>();

type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (res.socket.server.io) {
    console.log('Socket is already running');
  } else {
    console.log('Socket is initializing');
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    res.socket.server.io = io;

    io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      socket.on('join-room', ({ roomId, role }: { roomId: string; role: 'streamer' | 'viewer' }) => {
        console.log(`${socket.id} joining room ${roomId} as '${role}'`);
        
        socket.join(roomId);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, { viewers: new Set() });
        }

        const room = rooms.get(roomId)!;

        if (role === 'streamer') {
          if (room.streamer) {
            socket.emit('error', 'Room already has a streamer');
            return;
          }
          room.streamer = socket.id;
          
          room.viewers.forEach(viewerId => {
            io.to(viewerId).emit('streamer-joined');
          });
        } else {
          room.viewers.add(socket.id);
          
          if (room.streamer) {
            io.to(room.streamer).emit('viewer-joined', socket.id);
          }
        }
      });

      socket.on('signal', ({ to, signal, room }: { to: string; signal: unknown; room: string }) => {
        console.log(`Signal from ${socket.id} to ${to} in room ${room}`);
        
        if (to === 'streamer') {
          const roomData = rooms.get(room);
          if (roomData?.streamer) {
            io.to(roomData.streamer).emit('signal', { from: socket.id, signal });
          }
        } else {
          io.to(to).emit('streamer-signal', signal);
        }
      });

      socket.on('leave-room', (roomId: string) => {
        console.log(`${socket.id} leaving room ${roomId}`);
        handleLeaveRoom(socket.id, roomId, io);
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        rooms.forEach((room, roomId) => {
          handleDisconnect(socket.id, roomId, room, io);
        });
      });
    });

    function handleLeaveRoom(socketId: string, roomId: string, io: SocketIOServer) {
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.streamer === socketId) {
        room.viewers.forEach(viewerId => {
          io.to(viewerId).emit('streamer-disconnected');
        });
        rooms.delete(roomId);
      } else if (room.viewers.has(socketId)) {
        room.viewers.delete(socketId);
        if (room.streamer) {
          io.to(room.streamer).emit('viewer-disconnected', socketId);
        }
        
        if (!room.streamer && room.viewers.size === 0) {
          rooms.delete(roomId);
        }
      }
    }

    function handleDisconnect(socketId: string, roomId: string, room: Room, io: SocketIOServer) {
      if (room.streamer === socketId) {
        room.viewers.forEach(viewerId => {
          io.to(viewerId).emit('streamer-disconnected');
        });
        rooms.delete(roomId);
      } else if (room.viewers.has(socketId)) {
        room.viewers.delete(socketId);
        if (room.streamer) {
          io.to(room.streamer).emit('viewer-disconnected', socketId);
        }
        
        if (!room.streamer && room.viewers.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  }

  res.end();
}