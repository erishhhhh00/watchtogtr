import { Server as SocketIOServer, Socket } from 'socket.io';
import { Room, ChatMessage, SocketUser } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * SYNCHRONIZATION ALGORITHM:
 * 
 * Server-Authoritative Clock Approach:
 * 1. Server maintains master playback state (currentTime, isPlaying, lastUpdated)
 * 2. When host sends play/pause/seek → server updates state with server timestamp
 * 3. Server broadcasts state to all clients with server time
 * 4. Clients calculate their local offset from server time
 * 5. Periodic sync every 5 seconds to correct drift (<500ms tolerance)
 * 
 * Drift Correction:
 * - Clients track: localTime = serverTime + (Date.now() - lastSyncTime)
 * - If |clientTime - serverTime| > 500ms → resync
 * - Uses server timestamp as source of truth to prevent cumulative drift
 */

// In-memory storage (replaces Redis for development)
const rooms = new Map<string, Room>();
const activeSockets = new Map<string, SocketUser>();

// Helper to get/set room data
async function getRoom(roomId: string): Promise<Room | null> {
  return rooms.get(roomId) || null;
}

async function setRoom(roomId: string, room: Room): Promise<void> {
  rooms.set(roomId, room);
}

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    /**
     * Join Room Handler
     * Adds user to room, broadcasts presence, sends current state
     */
    socket.on('join-room', async (data: { roomId: string; userId: string; username: string }) => {
      try {
        const { roomId, userId, username } = data;

        const room = await getRoom(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        const isHost = room.hostId === userId;

        // Store socket user info
        const socketUser: SocketUser = {
          userId,
          username,
          roomId,
          socketId: socket.id,
          isHost,
          isMuted: false,
        };
        activeSockets.set(socket.id, socketUser);

        // Join socket.io room
        socket.join(roomId);

        // Send current room state to joiner
        socket.emit('room-state', {
          room,
          participants: Array.from(activeSockets.values()).filter(u => u.roomId === roomId),
          serverTime: Date.now(),
        });

        // Notify others
        socket.to(roomId).emit('user-joined', {
          userId,
          username,
          isHost,
          serverTime: Date.now(),
        });

        logger.info(`User ${username} joined room ${roomId}`);
      } catch (error) {
        logger.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * Play Event Handler
     * Host-only: Updates server state, broadcasts to all clients
     */
    socket.on('play', async (data: { roomId: string }) => {
      try {
        const socketUser = activeSockets.get(socket.id);
        if (!socketUser || !socketUser.isHost) {
          socket.emit('error', { message: 'Only host can control playback' });
          return;
        }

        const { roomId } = data;
        const room = await getRoom(roomId);
        if (!room) return;

        const serverTime = Date.now();

        // Update playback state with server timestamp
        room.playbackState.isPlaying = true;
        room.playbackState.lastUpdated = serverTime;

        await setRoom(roomId, room);

        // Broadcast to all clients including sender
        io.to(roomId).emit('sync-state', {
          playbackState: room.playbackState,
          serverTime,
        });

        logger.info(`Room ${roomId}: Play event at ${room.playbackState.currentTime}s`);
      } catch (error) {
        logger.error('Error handling play:', error);
      }
    });

    /**
     * Pause Event Handler
     */
    socket.on('pause', async (data: { roomId: string; currentTime: number }) => {
      try {
        const socketUser = activeSockets.get(socket.id);
        if (!socketUser || !socketUser.isHost) {
          socket.emit('error', { message: 'Only host can control playback' });
          return;
        }

        const { roomId, currentTime } = data;
        const room = await getRoom(roomId);
        if (!room) return;

        const serverTime = Date.now();

        room.playbackState.isPlaying = false;
        room.playbackState.currentTime = currentTime;
        room.playbackState.lastUpdated = serverTime;

        await setRoom(roomId, room);

        io.to(roomId).emit('sync-state', {
          playbackState: room.playbackState,
          serverTime,
        });

        logger.info(`Room ${roomId}: Pause event at ${currentTime}s`);
      } catch (error) {
        logger.error('Error handling pause:', error);
      }
    });

    /**
     * Seek Event Handler
     * Updates current time and syncs all clients
     */
    socket.on('seek', async (data: { roomId: string; currentTime: number }) => {
      try {
        const socketUser = activeSockets.get(socket.id);
        if (!socketUser || !socketUser.isHost) {
          socket.emit('error', { message: 'Only host can seek' });
          return;
        }

        const { roomId, currentTime } = data;
        const room = await getRoom(roomId);
        if (!room) return;

        const serverTime = Date.now();

        room.playbackState.currentTime = currentTime;
        room.playbackState.lastUpdated = serverTime;

        await setRoom(roomId, room);

        io.to(roomId).emit('sync-state', {
          playbackState: room.playbackState,
          serverTime,
        });

        logger.info(`Room ${roomId}: Seek to ${currentTime}s`);
      } catch (error) {
        logger.error('Error handling seek:', error);
      }
    });

    /**
     * Change Video Source
     */
    socket.on('change-source', async (data: { roomId: string; url: string; videoType: string }) => {
      try {
        const socketUser = activeSockets.get(socket.id);
        if (!socketUser || !socketUser.isHost) {
          socket.emit('error', { message: 'Only host can change video' });
          return;
        }

        const { roomId, url, videoType } = data;
        const room = await getRoom(roomId);
        if (!room) return;

        const serverTime = Date.now();

        room.playbackState = {
          url,
          currentTime: 0,
          isPlaying: false,
          lastUpdated: serverTime,
          videoType: videoType as any,
        };

        await setRoom(roomId, room);

        io.to(roomId).emit('sync-state', {
          playbackState: room.playbackState,
          serverTime,
        });

        logger.info(`Room ${roomId}: Changed source to ${url}`);
      } catch (error) {
        logger.error('Error changing source:', error);
      }
    });

    /**
     * Chat Message Handler
     * Broadcasts message with XSS protection
     */
    socket.on('chat-message', async (data: { roomId: string; message: string }) => {
      try {
        const socketUser = activeSockets.get(socket.id);
        if (!socketUser) return;

        const { roomId, message } = data;
        
        // Basic XSS protection: escape HTML
        const sanitizedMessage = message
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .substring(0, 500); // Limit message length

        const chatMessage: ChatMessage = {
          id: uuidv4(),
          userId: socketUser.userId,
          username: socketUser.username,
          message: sanitizedMessage,
          timestamp: Date.now(),
        };

        // Store in room history (keep last 100 messages)
        const room = await getRoom(roomId);
        if (room) {
          room.chatHistory.push(chatMessage);
          if (room.chatHistory.length > 100) {
            room.chatHistory.shift();
          }
          await setRoom(roomId, room);
        }

        io.to(roomId).emit('chat-message', chatMessage);
      } catch (error) {
        logger.error('Error handling chat message:', error);
      }
    });

    /**
     * WEBRTC SIGNALING FLOW:
     * 
     * 1. Peer A joins → creates offer → sends to signaling server
     * 2. Server relays offer to Peer B
     * 3. Peer B creates answer → sends to server
     * 4. Server relays answer to Peer A
     * 5. Both peers exchange ICE candidates via server
     * 6. Direct P2P audio connection established
     * 
     * The signaling server only facilitates connection setup,
     * actual media flows peer-to-peer (or via TURN if needed)
     */

    socket.on('webrtc-offer', (data: { roomId: string; offer: any; targetUserId?: string }) => {
      const { roomId, offer, targetUserId } = data;
      const socketUser = activeSockets.get(socket.id);
      if (!socketUser) return;

      if (targetUserId) {
        // Send to specific user
        const targetSocket = Array.from(activeSockets.entries()).find(
          ([_, user]) => user.userId === targetUserId && user.roomId === roomId
        );
        if (targetSocket) {
          io.to(targetSocket[0]).emit('webrtc-offer', {
            offer,
            fromUserId: socketUser.userId,
            fromUsername: socketUser.username,
          });
        }
      } else {
        // Broadcast to room
        socket.to(roomId).emit('webrtc-offer', {
          offer,
          fromUserId: socketUser.userId,
          fromUsername: socketUser.username,
        });
      }
    });

    socket.on('webrtc-answer', (data: { roomId: string; answer: any; targetUserId: string }) => {
      const { roomId, answer, targetUserId } = data;
      const socketUser = activeSockets.get(socket.id);
      if (!socketUser) return;

      const targetSocket = Array.from(activeSockets.entries()).find(
        ([_, user]) => user.userId === targetUserId && user.roomId === roomId
      );
      if (targetSocket) {
        io.to(targetSocket[0]).emit('webrtc-answer', {
          answer,
          fromUserId: socketUser.userId,
          fromUsername: socketUser.username,
        });
      }
    });

    socket.on('webrtc-ice-candidate', (data: { roomId: string; candidate: any; targetUserId: string }) => {
      const { roomId, candidate, targetUserId } = data;
      const socketUser = activeSockets.get(socket.id);
      if (!socketUser) return;

      const targetSocket = Array.from(activeSockets.entries()).find(
        ([_, user]) => user.userId === targetUserId && user.roomId === roomId
      );
      if (targetSocket) {
        io.to(targetSocket[0]).emit('webrtc-ice-candidate', {
          candidate,
          fromUserId: socketUser.userId,
        });
      }
    });

    /**
     * Kick User (Host only)
     */
    socket.on('kick-user', async (data: { roomId: string; userId: string }) => {
      try {
        const socketUser = activeSockets.get(socket.id);
        if (!socketUser || !socketUser.isHost) {
          socket.emit('error', { message: 'Only host can kick users' });
          return;
        }

        const { roomId, userId } = data;
        const targetSocket = Array.from(activeSockets.entries()).find(
          ([_, user]) => user.userId === userId && user.roomId === roomId
        );

        if (targetSocket) {
          io.to(targetSocket[0]).emit('kicked', { message: 'You were removed from the room' });
          io.sockets.sockets.get(targetSocket[0])?.leave(roomId);
        }
      } catch (error) {
        logger.error('Error kicking user:', error);
      }
    });

    /**
     * Disconnect Handler
     * Clean up user from room and notify others
     */
    socket.on('disconnect', async () => {
      try {
        const socketUser = activeSockets.get(socket.id);
        if (socketUser) {
          const { roomId, userId, username } = socketUser;
          activeSockets.delete(socket.id);

          socket.to(roomId).emit('user-left', {
            userId,
            username,
            serverTime: Date.now(),
          });

          logger.info(`User ${username} disconnected from room ${roomId}`);
        }
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });
  });

  /**
   * Periodic Sync Broadcast
   * Every 5 seconds, send current state to all rooms for drift correction
   */
  setInterval(async () => {
    try {
      const roomIds = new Set(Array.from(activeSockets.values()).map(u => u.roomId));
      
      for (const roomId of roomIds) {
        const room = await getRoom(roomId);
        if (room) {
          const serverTime = Date.now();

          // If playing, update current time based on elapsed time
          if (room.playbackState.isPlaying) {
            const elapsed = (serverTime - room.playbackState.lastUpdated) / 1000;
            room.playbackState.currentTime += elapsed;
            room.playbackState.lastUpdated = serverTime;
            await setRoom(roomId, room);
          }

          io.to(roomId).emit('sync-state', {
            playbackState: room.playbackState,
            serverTime,
          });
        }
      }
    } catch (error) {
      logger.error('Error in periodic sync:', error);
    }
  }, 5000);
}

// Export room storage for routes
export { rooms };
