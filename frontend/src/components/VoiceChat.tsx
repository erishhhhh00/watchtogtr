import { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';
import { useAuthStore } from '../stores/authStore';

interface PeerConnection {
  userId: string;
  username: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

function VoiceChat() {
  const { room, participants } = useRoomStore();
  const user = useAuthStore((state) => state.user);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Create peer connection
  const createPeerConnection = async (targetUserId: string, targetUsername: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio track
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track from', targetUsername);
      const [remoteStream] = event.streams;
      
      // Create or get audio element for this user
      let audioElement = audioElementsRef.current.get(targetUserId);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElementsRef.current.set(targetUserId, audioElement);
      }
      audioElement.srcObject = remoteStream;
      // Try to play immediately (some browsers require this)
      audioElement.play().catch((err) => {
        console.warn('Auto-play blocked, waiting for user gesture:', err);
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && room) {
        socketService.sendIceCandidate(room.id, event.candidate, targetUserId);
      }
    };

    // Store peer connection
    peerConnectionsRef.current.set(targetUserId, {
      userId: targetUserId,
      username: targetUsername,
      pc,
    });

    return pc;
  };

  // Start voice chat
  const startVoiceChat = async () => {
    try {
      setIsConnecting(true);
      
      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      localStreamRef.current = stream;
      setIsVoiceEnabled(true);
      setIsConnecting(false);

      // Create peer connections with all participants except self
      if (user && room) {
        for (const participant of participants) {
          if (participant.userId !== user.id) {
            const pc = await createPeerConnection(participant.userId, participant.username);
            
            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketService.sendOffer(room.id, offer, participant.userId);
          }
        }
      }
    } catch (error) {
      console.error('Error starting voice chat:', error);
      alert('Failed to access microphone. Please check permissions.');
      setIsConnecting(false);
    }
  };

  // Stop voice chat
  const stopVoiceChat = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(({ pc }) => pc.close());
    peerConnectionsRef.current.clear();

    // Stop all audio elements
    audioElementsRef.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    setIsVoiceEnabled(false);
    setIsMuted(false);
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Handle WebRTC signaling
  useEffect(() => {
    if (!room || !user || !isVoiceEnabled) return;

    // Handle incoming offer
    const handleOffer = async (data: { fromUserId: string; fromUsername: string; offer: RTCSessionDescriptionInit }) => {
      console.log('Received offer from', data.fromUsername);
      
      const pc = await createPeerConnection(data.fromUserId, data.fromUsername);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socketService.sendAnswer(room.id, answer, data.fromUserId);
    };

    // Handle incoming answer
    const handleAnswer = async (data: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
      console.log('Received answer from', data.fromUserId);
      
      const peerConnection = peerConnectionsRef.current.get(data.fromUserId);
      if (peerConnection) {
        await peerConnection.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      const peerConnection = peerConnectionsRef.current.get(data.fromUserId);
      if (peerConnection) {
        await peerConnection.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    socketService.onWebRTCOffer(handleOffer);
    socketService.onWebRTCAnswer(handleAnswer);
    socketService.onWebRTCIceCandidate(handleIceCandidate);

    // Don't cleanup voice chat on unmount - only when explicitly stopped
    return () => {
      // Keep connections alive, just remove listeners
    };
  }, [room, user, isVoiceEnabled]);

  // Handle participant changes
  useEffect(() => {
    if (!isVoiceEnabled || !user || !room) return;

    // Remove disconnected peers
    const currentUserIds = new Set(participants.map(p => p.userId));
    peerConnectionsRef.current.forEach((peerConn, userId) => {
      if (!currentUserIds.has(userId)) {
        peerConn.pc.close();
        peerConnectionsRef.current.delete(userId);
        
        const audioElement = audioElementsRef.current.get(userId);
        if (audioElement) {
          audioElement.pause();
          audioElement.srcObject = null;
          audioElementsRef.current.delete(userId);
        }
      }
    });

    // Add new participants
    participants.forEach(async (participant) => {
      if (participant.userId !== user.id && !peerConnectionsRef.current.has(participant.userId)) {
        const pc = await createPeerConnection(participant.userId, participant.username);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.sendOffer(room.id, offer, participant.userId);
      }
    });
  }, [participants, isVoiceEnabled, user, room]);

  return (
    <div className="bg-darker rounded-lg p-4 shadow-lg border border-pink-500/20">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        🎤 Voice Chat
        <span className="text-xs text-pink-400">Aahana & DEEP 💕</span>
      </h3>

      <div className="space-y-3">
        {!isVoiceEnabled ? (
          <button
            onClick={startVoiceChat}
            disabled={isConnecting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Connecting...
              </>
            ) : (
              <>
                <span className="text-xl">🎙️</span>
                Join Voice Chat
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={toggleMute}
                className={`flex-1 ${
                  isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                } text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2`}
              >
                <span className="text-xl">{isMuted ? '🔇' : '🔊'}</span>
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              
              <button
                onClick={stopVoiceChat}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-xl">📞</span>
                Leave Voice
              </button>
            </div>

            <div className="bg-dark rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">Voice chat active</span>
              </div>
              
              {peerConnectionsRef.current.size > 0 ? (
                <div className="mt-2 text-xs text-gray-300">
                  🔊 Connected with {peerConnectionsRef.current.size} participant(s)
                </div>
              ) : (
                <div className="mt-2 text-xs text-yellow-400">
                  ⏳ Waiting for other participants to join...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 bg-dark rounded p-2">
          💡 Enable your microphone to talk with other participants in real-time
        </div>
      </div>
    </div>
  );
}

export default VoiceChat;
