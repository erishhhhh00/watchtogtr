import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authService, roomService } from '../services/api';

function Landing() {
  const [mode, setMode] = useState<'home' | 'login' | 'register' | 'guest'>('home');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.login(username, password);
      setUser(data.user);
      setToken(data.token);
      setMode('home');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.register(username, email, password);
      setUser(data.user);
      setToken(data.token);
      setMode('home');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.joinAsGuest(username);
      setUser(data.user);
      setToken(data.token);
      if (joinRoomId) {
        // Resolve 5-digit codes to actual room IDs before navigating
        let target = (joinRoomId || '').trim();
        if (/^\d{5}$/.test(target)) {
          const { room } = await roomService.getRoomByCode(target);
          target = room.id;
        }
        navigate(`/room/${target}`);
      } else {
        setMode('home');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join as guest');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      setMode('guest');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { room } = await roomService.createRoom(roomName || 'My Room', user.id);
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      setMode('guest');
      return;
    }

    const raw = (joinRoomId || '').trim();
    if (!raw) {
      setError('Please enter room code or ID');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let roomId = raw;
      
      // If 5-digit code, get room by code
      if (/^\d{5}$/.test(raw)) {
        const { room } = await roomService.getRoomByCode(raw);
        roomId = room.id;
      }
      
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Room not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark via-darker to-dark p-4">
      <div className="max-w-md w-full bg-darker rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            🎬 Watch With Friends
          </h1>
          <p className="text-2xl text-pink-400 font-semibold mt-3 mb-2">
            💕 Aahana & DEEP Together 💕
          </p>
          <p className="text-gray-400 text-lg">
            Watch videos together in perfect sync
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {mode === 'home' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Room Name (Optional)</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="My Awesome Room"
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white"
              />
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              Create Room
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-darker text-gray-400">or</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Join Existing Room</label>
              <input
                type="text"
                inputMode="numeric"
                value={joinRoomId}
                onChange={(e) => {
                  // Keep only digits; limit to 5
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setJoinRoomId(digits);
                }}
                placeholder="Enter 5-digit room code"
                maxLength={5}
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white text-center text-2xl font-mono tracking-widest"
              />
              <p className="text-xs text-gray-400 mt-1">Example: 12345</p>
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={loading || !joinRoomId}
              className="w-full bg-secondary hover:bg-secondary/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              Join Room
            </button>

            <div className="pt-4 border-t border-gray-700 space-y-2">
              <button
                onClick={() => setMode('login')}
                className="w-full text-gray-400 hover:text-white transition-colors"
              >
                Already have an account? Login
              </button>
              <button
                onClick={() => setMode('register')}
                className="w-full text-gray-400 hover:text-white transition-colors"
              >
                New here? Register
              </button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={() => setMode('home')}
              className="w-full text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
            <button
              type="button"
              onClick={() => setMode('home')}
              className="w-full text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'guest' && (
          <form onSubmit={handleGuestJoin} className="space-y-4">
            <p className="text-gray-400 text-sm">
              Enter a username to join as a guest
            </p>
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Continue as Guest'}
            </button>
            <button
              type="button"
              onClick={() => setMode('home')}
              className="w-full text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
          </form>
        )}

        <div className="pt-4 text-center text-xs text-gray-500">
          <p>By using this app, you agree that you have the rights to share any content you upload.</p>
        </div>
      </div>
    </div>
  );
}

export default Landing;
