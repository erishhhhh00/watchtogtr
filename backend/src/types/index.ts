export interface User {
  id: string;
  username: string;
  email?: string;
  isGuest: boolean;
  createdAt: Date;
}

export interface Room {
  id: string;
  code?: string; // 5-digit join code
  hostId: string;
  name: string;
  participants: string[]; // user IDs
  playbackState: PlaybackState;
  chatHistory: ChatMessage[];
  createdAt: Date;
  maxParticipants: number;
}

export interface PlaybackState {
  url: string;
  currentTime: number; // seconds
  isPlaying: boolean;
  lastUpdated: number; // server timestamp
  videoType: 'youtube' | 'mp4' | 'hls' | 'vimeo';
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface SocketUser {
  userId: string;
  username: string;
  roomId: string;
  socketId: string;
  isHost: boolean;
  isMuted: boolean;
}
