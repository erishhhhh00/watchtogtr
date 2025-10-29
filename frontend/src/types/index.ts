export interface User {
  id: string;
  username: string;
  email?: string;
  isGuest: boolean;
}

export interface Room {
  id: string;
  code?: string; // 5-digit join code
  hostId: string;
  name: string;
  participants: string[];
  playbackState: PlaybackState;
  chatHistory: ChatMessage[];
  createdAt: Date;
  maxParticipants: number;
}

export interface PlaybackState {
  url: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
  videoType: 'youtube' | 'mp4' | 'hls' | 'vimeo';
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface Participant {
  userId: string;
  username: string;
  isHost: boolean;
  isMuted: boolean;
}
