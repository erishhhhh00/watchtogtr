import axios from 'axios';
import { User, Room } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Debug log (remove after testing)
console.log('API_URL:', API_URL);

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  // Prevent indefinite spinners if the backend is unreachable
  timeout: 10000,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize network errors for clearer UI messages
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Axios timeout
    if (error.code === 'ECONNABORTED') {
      error.message = `Request timed out. Backend not responding at ${API_URL}.`;
    }
    // Network error / CORS failure
    if (error.message && /Network Error/i.test(error.message)) {
      error.message = `Cannot reach backend at ${API_URL}. Is the server running?`;
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async register(username: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('token', response.data.token);
    return response.data;
  },

  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    const response = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', response.data.token);
    return response.data;
  },

  async joinAsGuest(username: string): Promise<{ user: User; token: string }> {
    const response = await api.post('/auth/guest', { username });
    localStorage.setItem('token', response.data.token);
    return response.data;
  },

  logout() {
    localStorage.removeItem('token');
  },
};

export const roomService = {
  async createRoom(name: string, hostId: string, maxParticipants: number = 10): Promise<{ room: Room }> {
    console.log(`[API] Creating room: name="${name}", hostId="${hostId}"`);
    const response = await api.post('/rooms', { name, hostId, maxParticipants });
    console.log('[API] Room created:', response.data.room);
    return response.data;
  },

  async getRoom(roomId: string): Promise<{ room: Room }> {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },

  async getRoomByCode(code: string): Promise<{ room: Room }> {
    console.log(`[API] Looking up room by code: "${code}" at ${API_URL}/api/rooms/code/${code}`);
    const response = await api.get(`/rooms/code/${code}`);
    console.log('[API] Room found:', response.data);
    return response.data;
  },

  async joinRoom(roomId: string, userId: string): Promise<{ room: Room }> {
    const response = await api.post(`/rooms/${roomId}/join`, { userId });
    return response.data;
  },
};
