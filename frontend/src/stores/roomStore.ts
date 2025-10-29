import { create } from 'zustand';
import { Room, PlaybackState, ChatMessage, Participant } from '../types';

interface RoomStore {
  room: Room | null;
  participants: Participant[];
  messages: ChatMessage[];
  isHost: boolean;
  setRoom: (room: Room | null) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  updatePlaybackState: (state: PlaybackState) => void;
  addMessage: (message: ChatMessage) => void;
  setIsHost: (isHost: boolean) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  participants: [],
  messages: [],
  isHost: false,
  setRoom: (room) => set({ room }),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),
  removeParticipant: (userId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.userId !== userId),
    })),
  updatePlaybackState: (playbackState) =>
    set((state) => ({
      room: state.room ? { ...state.room, playbackState } : null,
    })),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  setIsHost: (isHost) => set({ isHost }),
  clearRoom: () =>
    set({
      room: null,
      participants: [],
      messages: [],
      isHost: false,
    }),
}));
