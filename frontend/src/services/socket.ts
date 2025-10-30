import { io, Socket } from 'socket.io-client';
import { PlaybackState, ChatMessage, Participant } from '../types';

// Prefer explicit WS URL; else fall back to API URL; else localhost
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001';

/**
 * Socket.IO Service for real-time communication
 * Handles room events, playback sync, chat, and WebRTC signaling
 */
class SocketService {
  private socket: Socket | null = null;
  private serverTimeOffset: number = 0; // Client time - Server time
  private reconnectCallback: (() => void) | null = null;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(WS_URL, {
      // Allow both transports to maximize production compatibility behind proxies
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
      // Reconnection settings for network issues
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying until network comes back
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      // Auto-rejoin room after reconnection
      if (this.reconnectCallback) {
        console.log('🔄 Rejoining room after reconnection...');
        this.reconnectCallback();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server kicked us, reconnect manually
        this.socket?.connect();
      }
      // For 'io client disconnect', don't auto-reconnect (user left intentionally)
      // For 'transport close' or 'ping timeout', socket.io will auto-reconnect
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Reconnection attempt ${attempt}...`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after all attempts');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connect_error:', err?.message || err);
    });

    return this.socket;
  }

  // Set callback to rejoin room after reconnection
  setReconnectCallback(callback: () => void) {
    this.reconnectCallback = callback;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Room Events
  joinRoom(roomId: string, userId: string, username: string) {
    this.socket?.emit('join-room', { roomId, userId, username });
  }

  // Playback Control Events (Host only)
  play(roomId: string) {
    this.socket?.emit('play', { roomId });
  }

  pause(roomId: string, currentTime: number) {
    this.socket?.emit('pause', { roomId, currentTime });
  }

  seek(roomId: string, currentTime: number) {
    this.socket?.emit('seek', { roomId, currentTime });
  }

  changeSource(roomId: string, url: string, videoType: string) {
    this.socket?.emit('change-source', { roomId, url, videoType });
  }

  // Chat Events
  sendMessage(roomId: string, message: string, clientMessageId?: string, imageUrl?: string, type?: string) {
    this.socket?.emit('chat-message', { roomId, message, clientMessageId, imageUrl, type });
  }

  // Host Controls
  kickUser(roomId: string, userId: string) {
    this.socket?.emit('kick-user', { roomId, userId });
  }

  // WebRTC Signaling
  sendOffer(roomId: string, offer: RTCSessionDescriptionInit, targetUserId?: string) {
    this.socket?.emit('webrtc-offer', { roomId, offer, targetUserId });
  }

  sendAnswer(roomId: string, answer: RTCSessionDescriptionInit, targetUserId: string) {
    this.socket?.emit('webrtc-answer', { roomId, answer, targetUserId });
  }

  sendIceCandidate(roomId: string, candidate: RTCIceCandidate, targetUserId: string) {
    this.socket?.emit('webrtc-ice-candidate', { roomId, candidate, targetUserId });
  }

  // Event Listeners
  onRoomState(callback: (data: { room: any; participants: Participant[]; serverTime: number }) => void) {
    this.socket?.on('room-state', (data) => {
      this.updateServerTimeOffset(data.serverTime);
      callback(data);
    });
  }

  onSyncState(callback: (data: { playbackState: PlaybackState; serverTime: number }) => void) {
    this.socket?.on('sync-state', (data) => {
      this.updateServerTimeOffset(data.serverTime);
      callback(data);
    });
  }

  onUserJoined(callback: (data: { userId: string; username: string; isHost: boolean }) => void) {
    this.socket?.on('user-joined', callback);
  }

  onUserLeft(callback: (data: { userId: string; username: string }) => void) {
    this.socket?.on('user-left', callback);
  }

  onChatMessage(callback: (message: ChatMessage) => void) {
    this.socket?.on('chat-message', callback);
  }

  onWebRTCOffer(callback: (data: { offer: RTCSessionDescriptionInit; fromUserId: string; fromUsername: string }) => void) {
    this.socket?.on('webrtc-offer', callback);
  }

  onWebRTCAnswer(callback: (data: { answer: RTCSessionDescriptionInit; fromUserId: string }) => void) {
    this.socket?.on('webrtc-answer', callback);
  }

  onWebRTCIceCandidate(callback: (data: { candidate: RTCIceCandidate; fromUserId: string }) => void) {
    this.socket?.on('webrtc-ice-candidate', callback);
  }

  onKicked(callback: () => void) {
    this.socket?.on('kicked', callback);
  }

  onKickResult(callback: (data: { ok: boolean; userId?: string; message?: string }) => void) {
    this.socket?.on('kick-result', callback);
  }

  onRoomClosed(callback: () => void) {
    this.socket?.on('room-closed', callback);
  }

  onError(callback: (error: { message: string }) => void) {
    this.socket?.on('error', callback);
  }

  /**
   * Update server time offset for drift correction
   * Used to calculate accurate playback position
   */
  private updateServerTimeOffset(serverTime: number) {
    this.serverTimeOffset = Date.now() - serverTime;
  }

  /**
   * Get current server time estimate
   */
  getServerTime(): number {
    return Date.now() - this.serverTimeOffset;
  }

  /**
   * Calculate expected video time based on server state
   * Implements drift correction algorithm
   */
  calculateExpectedTime(playbackState: PlaybackState): number {
    if (!playbackState.isPlaying) {
      return playbackState.currentTime;
    }

    const serverTime = this.getServerTime();
    const elapsedSinceUpdate = (serverTime - playbackState.lastUpdated) / 1000;
    return playbackState.currentTime + elapsedSinceUpdate;
  }
}

export const socketService = new SocketService();
