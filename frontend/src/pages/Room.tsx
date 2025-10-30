import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';
import { roomService, authService } from '../services/api';
import VideoPlayer from '../components/VideoPlayer';
import ChatPanel from '../components/ChatPanel';
import ParticipantsList from '../components/ParticipantsList';
import Controls from '../components/Controls';

function Room() {
  const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { room, setRoom, setParticipants, addParticipant, removeParticipant, updatePlaybackState, setIsHost, clearRoom, setMessages } =
    useRoomStore();
  const participants = useRoomStore((state) => state.participants);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const socketConnected = useRef(false);
  const isInitialized = useRef(false);

  // Store room session in sessionStorage for refresh persistence
  useEffect(() => {
    if (roomId && user) {
      sessionStorage.setItem('currentRoomId', roomId);
      sessionStorage.setItem('currentUserId', user.id);
      sessionStorage.setItem('currentUsername', user.username);
    }
  }, [roomId, user]);

  useEffect(() => {
    const init = async () => {
      try {
        // Prevent duplicate initialization
        if (isInitialized.current) return;
        isInitialized.current = true;

        if (!roomId) {
          console.error('Missing roomId');
          setError('Room ID missing');
          setLoading(false);
          return;
        }

        // Ensure we have a user; if not, auto-join as a guest
        let currentUser = user;
        if (!currentUser) {
          const guestName = `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
          try {
            const data = await authService.joinAsGuest(guestName);
            useAuthStore.getState().setUser(data.user);
            useAuthStore.getState().setToken(data.token);
            currentUser = data.user;
          } catch (e) {
            console.error('Auto guest join failed', e);
            setError('Failed to authenticate as guest');
            setLoading(false);
            return;
          }
        }

        console.log('Fetching room:', roomId);
        // Fetch room details
        const { room: roomData } = await roomService.getRoom(roomId);
        console.log('Room data received:', roomData);
        
        await roomService.joinRoom(roomId, currentUser.id);
        console.log('Joined room successfully');
        
        setRoom(roomData);
        if (roomData.chatHistory) {
          setMessages(roomData.chatHistory);
        }
        setIsHost(roomData.hostId === currentUser.id);
        
        // Connect socket with auto-rejoin on reconnection
        if (!socketConnected.current) {
          const socket = socketService.connect();
          
          // Listen for reconnection events
          socket.on('disconnect', () => {
            setIsReconnecting(true);
          });
          
          socket.on('connect', () => {
            setIsReconnecting(false);
          });
          
          // Set up auto-rejoin callback for reconnections
          socketService.setReconnectCallback(() => {
            console.log('🔄 Auto-rejoining room after reconnection...');
            setIsReconnecting(false);
            socketService.joinRoom(roomId, currentUser.id, currentUser.username);
          });
          
          socketService.joinRoom(roomId, currentUser.id, currentUser.username);
          socketConnected.current = true;
        }

        // Setup socket listeners
        socketService.onRoomState((data) => {
          setRoom(data.room);
          setParticipants(data.participants);
        });

        socketService.onSyncState((data) => {
          updatePlaybackState(data.playbackState);
        });

        socketService.onUserJoined((data) => {
          addParticipant({
            userId: data.userId,
            username: data.username,
            isHost: data.isHost,
            isMuted: false,
          });
          // System message to everyone else
          useRoomStore.getState().addMessage({
            id: `sys-join-${data.userId}-${Date.now()}`,
            userId: 'system',
            username: 'System',
            message: `${data.username} joined the room`,
            timestamp: Date.now(),
            isSystem: true,
          });
        });

        socketService.onUserLeft((data) => {
          removeParticipant(data.userId);
          useRoomStore.getState().addMessage({
            id: `sys-left-${data.userId}-${Date.now()}`,
            userId: 'system',
            username: 'System',
            message: `${data.username} left the room`,
            timestamp: Date.now(),
            isSystem: true,
          });
        });

        socketService.onKicked(() => {
          alert('You have been removed from the room');
          navigate('/');
        });

        socketService.onError((err) => {
          setError(err.message);
        });

        // Host leaves → room closed
        socketService.onRoomClosed(() => {
          alert('Host left. Room is closed.');
          clearRoom();
          navigate('/');
        });

        setLoading(false);
      } catch (err: any) {
        console.error('Room init error:', err);
        console.error('Error response:', err.response?.data);
        setError(err.response?.data?.message || 'Failed to join room');
        setLoading(false);
      }
    };

    init();

    return () => {
      // DON'T disconnect socket on unmount - keep connection alive
      // Only disconnect when user explicitly leaves
      // This allows refresh and navigation without losing connection
    };
  }, [roomId, user]);

  const handleLeaveRoom = () => {
    // Clean disconnect only when user explicitly leaves
    if (socketConnected.current) {
      socketService.disconnect();
      socketConnected.current = false;
    }
    sessionStorage.removeItem('currentRoomId');
    sessionStorage.removeItem('currentUserId');
    sessionStorage.removeItem('currentUsername');
    clearRoom();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="text-white text-xl">Loading room...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="bg-darker rounded-lg p-8 max-w-md">
          <h2 className="text-red-500 text-xl font-bold mb-4">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={handleLeaveRoom}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2 rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      {/* Reconnection Banner */}
      {isReconnecting && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/50 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-yellow-300">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-300 border-t-transparent"></div>
            <span className="text-sm font-medium">🔄 Reconnecting... Trying to restore connection...</span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-darker border-b border-pink-500/30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {room?.name}
              <span className="text-pink-400 text-sm">💕 Aahana & DEEP</span>
            </h1>
            {room?.code && (
              <p className="text-sm text-gray-400 mt-1">
                Room Code: <span className="text-pink-400 font-mono font-bold text-lg">{room.code}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(room.code!);
                    alert('Room code copied!');
                  }}
                  className="ml-2 text-xs bg-pink-500/20 hover:bg-pink-500/30 px-2 py-1 rounded"
                >
                  Copy
                </button>
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-300">
              👥 Participants: <span className="font-semibold text-white">{participants.length}</span>
            </div>
            <div className="hidden sm:block text-[10px] text-gray-500 font-mono">API: {API_URL}</div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Room link copied!');
              }}
              className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg text-sm font-medium"
            >
              📋 Copy Invite Link
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-4 gap-4">
        {/* Video Section */}
        <div className="flex-1 flex flex-col gap-4">
          <VideoPlayer />
          <Controls />
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
          <ParticipantsList />
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

export default Room;
