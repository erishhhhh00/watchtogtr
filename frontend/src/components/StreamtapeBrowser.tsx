import { useState } from 'react';

interface StreamtapeBrowserProps {
  onClose: () => void;
  onVideoSelect: (url: string) => void;
}

interface VideoInfo {
  id: string;
  title: string;
  videoUrl: string;
  embedUrl: string;
  proxyUrl: string;
}

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

export function StreamtapeBrowser({ onClose, onVideoSelect }: StreamtapeBrowserProps) {
  const [streamtapeUrl, setStreamtapeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  const fetchVideoInfo = async () => {
    if (!streamtapeUrl.trim()) {
      setError('Please enter a Streamtape URL');
      return;
    }

    setLoading(true);
    setError('');
    setVideoInfo(null);

    try {
      const response = await fetch(
        `${API_URL}/api/proxy/streamtape/info?url=${encodeURIComponent(streamtapeUrl)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch video info');
      }

      const data: VideoInfo = await response.json();
      setVideoInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVideo = () => {
    if (videoInfo) {
      // Use the proxy URL for better compatibility
      onVideoSelect(videoInfo.proxyUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Add Streamtape Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Streamtape Video URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={streamtapeUrl}
                onChange={(e) => setStreamtapeUrl(e.target.value)}
                placeholder="https://streamtape.com/v/xxxxx or https://streamtape.com/e/xxxxx"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && fetchVideoInfo()}
              />
              <button
                onClick={fetchVideoInfo}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {loading ? 'Loading...' : 'Get Info'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Paste the Streamtape video URL (view or embed page)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Video Info */}
          {videoInfo && (
            <div className="p-4 bg-gray-700 rounded-lg space-y-3">
              <div>
                <p className="text-sm text-gray-400">Title</p>
                <p className="text-white font-medium">{videoInfo.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Video ID</p>
                <p className="text-white font-mono text-sm">{videoInfo.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Direct URL</p>
                <p className="text-white text-xs break-all">{videoInfo.videoUrl}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Proxy URL (Recommended)</p>
                <p className="text-white text-xs break-all">{videoInfo.proxyUrl}</p>
              </div>
              <button
                onClick={handleAddVideo}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                ✓ Add This Video to Room
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>How to use:</strong>
            </p>
            <ol className="text-sm text-blue-200 mt-2 space-y-1 list-decimal list-inside">
              <li>Copy the Streamtape video URL (from /v/ or /e/ page)</li>
              <li>Paste it above and click "Get Info"</li>
              <li>Review the video information</li>
              <li>Click "Add This Video to Room" to start watching</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
