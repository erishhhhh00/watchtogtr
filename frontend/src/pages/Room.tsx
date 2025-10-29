import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';
import { roomService } from '../services/api';
import VideoPlayer from '../components/VideoPlayer';
import ChatPanel from '../components/ChatPanel';
import ParticipantsList from '../components/ParticipantsList';
import Controls from '../components/Controls';

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { room, setRoom, setParticipants, addParticipant, removeParticipant, updatePlaybackState, setIsHost, clearRoom } =
    useRoomStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const socketConnected = useRef(false);

  useEffect(() => {
    if (!user || !roomId) {
      console.error('Missing user or roomId:', { user, roomId });
      setError('User not authenticated or room ID missing');
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        console.log('Fetching room:', roomId);
        // Fetch room details
        const { room: roomData } = await roomService.getRoom(roomId);
        console.log('Room data received:', roomData);
        
        await roomService.joinRoom(roomId, user.id);
        console.log('Joined room successfully');
        
        setRoom(roomData);
        setIsHost(roomData.hostId === user.id);
        
        // Connect socket
        if (!socketConnected.current) {
          socketService.connect();
          socketService.joinRoom(roomId, user.id, user.username);
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
        });

        socketService.onUserLeft((data) => {
          removeParticipant(data.userId);
        });

        socketService.onKicked(() => {
          alert('You have been removed from the room');
          navigate('/');
        });

        socketService.onError((err) => {
          setError(err.message);
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
      if (socketConnected.current) {
        socketService.disconnect();
        socketConnected.current = false;
      }
      clearRoom();
    };
  }, [roomId, user]);

  const handleLeaveRoom = () => {
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
      {/* Header */}
      <div className="bg-darker border-b border-pink-500/30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {room?.name}
              <span className="text-pink-400 text-sm">💕 Aahana & DEEP</span>
            </h1>
            <p className="text-sm text-gray-400">Room ID: {roomId}</p>
          </div>
          <div className="flex items-center gap-4">
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
