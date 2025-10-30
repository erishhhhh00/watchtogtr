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
  upsertMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
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
    set((state) => {
      // Check if participant already exists to prevent duplicates
      const exists = state.participants.some((p) => p.userId === participant.userId);
      if (exists) {
        return state;
      }
      return {
        participants: [...state.participants, participant],
      };
    }),
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
  upsertMessage: (message) =>
    set((state) => {
      // Replace optimistic message by matching clientMessageId with existing id
      if (message.clientMessageId) {
        const idx = state.messages.findIndex((m) => m.id === message.clientMessageId);
        if (idx !== -1) {
          const next = state.messages.slice();
          next[idx] = message;
          return { messages: next } as Partial<RoomStore> as RoomStore;
        }
      }
      // Or replace by id if exists
      const idxById = state.messages.findIndex((m) => m.id === message.id);
      if (idxById !== -1) {
        const next = state.messages.slice();
        next[idxById] = message;
        return { messages: next } as Partial<RoomStore> as RoomStore;
      }
      // Append otherwise
      return { messages: [...state.messages, message] } as Partial<RoomStore> as RoomStore;
    }),
  setMessages: (messages) => set({ messages }),
  setIsHost: (isHost) => set({ isHost }),
  clearRoom: () =>
    set({
      room: null,
      participants: [],
      messages: [],
      isHost: false,
    }),
}));
