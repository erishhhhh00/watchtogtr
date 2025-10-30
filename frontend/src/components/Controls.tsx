import { useState } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';

// Infer video type from URL when possible
function detectTypeFromUrl(url: string): 'mp4' | 'youtube' | 'hls' {
  const u = url.trim();
  if (!u) return 'mp4';
  // YouTube patterns
  if (/youtu\.be\//i.test(u) || /youtube\.com\/(watch\?|embed\/|shorts\/)/i.test(u)) {
    return 'youtube';
  }
  // HLS
  if (/\.m3u8(\?|$)/i.test(u)) return 'hls';
  return 'mp4';
}

function Controls() {
  const { room, isHost } = useRoomStore();
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoType, setVideoType] = useState<'mp4' | 'youtube' | 'hls'>('mp4');

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim() || !room) return;

    // Auto-detect type just before sending, so users don't have to pick manually
    const inferred = detectTypeFromUrl(videoUrl);
    const finalType = videoType || inferred;
    socketService.changeSource(room.id, videoUrl.trim(), finalType);
    setVideoUrl('');
    setShowUrlInput(false);
  };

  if (!isHost) {
    return (
      <div className="bg-darker rounded-lg p-4 shadow-lg">
        <p className="text-gray-400 text-sm text-center">
          Only the host can control playback
        </p>
      </div>
    );
  }

  return (
    <div className="bg-darker rounded-lg p-4 shadow-lg space-y-4 border border-pink-500/20">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        🎬 Host Controls
        <span className="text-xs text-pink-400">Made for Aahana 💖 DEEP</span>
      </h3>
      
      {!showUrlInput ? (
        <button
          onClick={() => setShowUrlInput(true)}
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 rounded-lg"
        >
          + Add Video URL
        </button>
      ) : (
        <form onSubmit={handleAddVideo} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video Type
            </label>
            <select
              value={videoType}
              onChange={(e) => setVideoType(e.target.value as any)}
              className="w-full px-3 py-2 bg-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            >
              <option value="mp4">MP4 (Direct Link)</option>
              <option value="hls">HLS Stream</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video URL
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => {
                const val = e.target.value;
                setVideoUrl(val);
                // Update type based on URL, but keep user's explicit selection if they change it after
                const inferred = detectTypeFromUrl(val);
                setVideoType(inferred);
              }}
              placeholder="YouTube, HLS (.m3u8), Google Drive, Seedr, or direct MP4/WebM link"
              className="w-full px-3 py-2 bg-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
              required
            />
            <div className="mt-2 text-xs text-gray-400 space-y-1">
              <p>📺 YouTube: https://youtube.com/watch?v=...</p>
              <p>📡 HLS: https://example.com/stream/index.m3u8</p>
              <p>📁 Google Drive: https://drive.google.com/file/d/...</p>
              <p>🌱 Seedr: https://www.seedr.cc/...</p>
              <p>🎬 Direct: https://example.com/video.mp4 (or .webm)</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-2 rounded-lg"
            >
              Load Video
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Note: Ensure you have rights to stream the content you share.
          </p>
        </form>
      )}

      <div className="pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          💡 Tip: Use the video player controls to play/pause and seek. All participants will stay synchronized.
        </p>
      </div>
    </div>
  );
}

export default Controls;
