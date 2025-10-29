import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';

interface VoiceChatState {
  isEnabled: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
}

function ChatPanel() {
  const user = useAuthStore((state) => state.user);
  const { room, messages, addMessage } = useRoomStore();
  const [inputMessage, setInputMessage] = useState('');
  const [voiceChat, setVoiceChat] = useState<VoiceChatState>({
    isEnabled: false,
    isMuted: false,
    localStream: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSetupListeners = useRef(false);

  useEffect(() => {
    // Listen for chat messages - setup only once
    if (!hasSetupListeners.current) {
      socketService.onChatMessage((message) => {
        console.log('Received chat message:', message);
        addMessage(message);
      });
      hasSetupListeners.current = true;
    }
  }, [addMessage]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !room) return;

    console.log('Sending message:', inputMessage);
    socketService.sendMessage(room.id, inputMessage);
    setInputMessage('');
  };

  const toggleVoiceChat = async () => {
    if (!voiceChat.isEnabled) {
      // Start voice chat
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
        setVoiceChat({
          isEnabled: true,
          isMuted: false,
          localStream: stream,
        });
      } catch (error) {
        console.error('Failed to access microphone:', error);
        alert('Failed to access microphone. Please check permissions.');
      }
    } else {
      // Stop voice chat
      if (voiceChat.localStream) {
        voiceChat.localStream.getTracks().forEach(track => track.stop());
      }
      setVoiceChat({
        isEnabled: false,
        isMuted: false,
        localStream: null,
      });
    }
  };

  const toggleMute = () => {
    if (voiceChat.localStream) {
      const audioTrack = voiceChat.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setVoiceChat({
          ...voiceChat,
          isMuted: !audioTrack.enabled,
        });
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceChat.localStream) {
        voiceChat.localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="bg-darker rounded-lg p-4 shadow-lg flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          Chat
          <span className="text-xs text-pink-400">💕 Aahana & DEEP</span>
        </h3>
        
        {/* Voice Chat Controls */}
        <div className="flex items-center gap-2">
          {voiceChat.isEnabled && (
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition-colors ${
                voiceChat.isMuted 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              title={voiceChat.isMuted ? 'Unmute' : 'Mute'}
            >
              <span className="text-lg">{voiceChat.isMuted ? '🔇' : '🔊'}</span>
            </button>
          )}
          
          <button
            onClick={toggleVoiceChat}
            className={`p-2 rounded-lg transition-colors ${
              voiceChat.isEnabled 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
            title={voiceChat.isEnabled ? 'Leave Voice Chat' : 'Join Voice Chat'}
          >
            <span className="text-lg">{voiceChat.isEnabled ? '📞' : '🎤'}</span>
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-[300px] max-h-[400px]">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No messages yet. Say hello! 👋
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 rounded-lg ${
                msg.userId === user?.id
                  ? 'bg-primary/20 ml-4'
                  : 'bg-dark mr-4'
              }`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-semibold text-white">
                  {msg.username}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-200">{msg.message}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-dark border border-gray-700 rounded-lg focus:outline-none focus:border-primary text-white text-sm"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;
