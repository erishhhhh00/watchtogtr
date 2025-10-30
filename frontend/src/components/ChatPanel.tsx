import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';
import type { ChatMessage } from '../types';

interface VoiceChatState {
  isEnabled: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
}

function ChatPanel() {
  const user = useAuthStore((state) => state.user);
  const { room, messages, addMessage, upsertMessage } = useRoomStore();
  const [inputMessage, setInputMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceChat, setVoiceChat] = useState<VoiceChatState>({
    isEnabled: false,
    isMuted: false,
    localStream: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSetupListeners = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Listen for chat messages - setup only once
    if (!hasSetupListeners.current) {
      socketService.onChatMessage((message) => {
        console.log('Received chat message:', message);
        upsertMessage(message);
      });
      hasSetupListeners.current = true;
    }
  }, [upsertMessage]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedImage) || !room) return;

    const clientMessageId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log('Sending message:', inputMessage, 'clientMessageId:', clientMessageId);

    const messageType = selectedImage ? 'image' : 'text';

    // Optimistic UI so mobile shows immediately
    if (user) {
      const optimistic: ChatMessage = {
        id: clientMessageId,
        userId: user.id,
        username: user.username,
        message: inputMessage || (selectedImage ? '📷 Image' : ''),
        timestamp: Date.now(),
        imageUrl: selectedImage || undefined,
        type: messageType,
      };
      addMessage(optimistic);
    }

    socketService.sendMessage(room.id, inputMessage, clientMessageId, selectedImage || undefined, messageType);
    setInputMessage('');
    setSelectedImage(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
                msg.isSystem 
                  ? 'bg-gray-700/30 mx-auto max-w-xs text-center'
                  : msg.userId === user?.id
                  ? 'bg-primary/20 ml-4'
                  : 'bg-dark mr-4'
              }`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-xs font-semibold ${msg.isSystem ? 'text-gray-400' : 'text-white'}`}>
                  {msg.username}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {msg.imageUrl && (
                <div className="mb-2">
                  <img 
                    src={msg.imageUrl} 
                    alt="Shared image"
                    className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90"
                    onClick={() => window.open(msg.imageUrl, '_blank')}
                  />
                </div>
              )}
              {msg.message && (
                <p className={`text-sm ${msg.isSystem ? 'text-gray-400 italic' : 'text-gray-200'}`}>
                  {msg.message}
                </p>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="space-y-2">
        {/* Image Preview */}
        {selectedImage && (
          <div className="relative inline-block">
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="max-h-24 rounded-lg border border-gray-700"
            />
            <button
              onClick={removeSelectedImage}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
              type="button"
            >
              ✕
            </button>
          </div>
        )}
        
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-dark hover:bg-gray-700 border border-gray-700 rounded-lg text-white transition-colors"
            title="Attach image"
          >
            <span className="text-lg">📷</span>
          </button>
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
            disabled={!inputMessage.trim() && !selectedImage}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatPanel;
