import { useState } from 'react';

interface WebBrowserProps {
  onVideoUrlFound: (url: string) => void;
  onClose: () => void;
}

function WebBrowser({ onVideoUrlFound, onClose }: WebBrowserProps) {
  const [browserUrl, setBrowserUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');
  const [error, setError] = useState('');

  const handleOpenSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!browserUrl.trim()) return;

    let url = browserUrl.trim();
    // Add https:// if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    setIframeUrl(url);
    setError('');
  };

  const handleExtractVideo = () => {
    const videoUrl = prompt(
      '📹 Paste the video URL from the website:\n\n' +
      'How to find it:\n' +
      '1. Right-click on video → "Copy video address"\n' +
      '2. Or inspect element and find <video> src\n' +
      '3. Or copy page URL if it\'s a video player page'
    );

    if (videoUrl) {
      onVideoUrlFound(videoUrl.trim());
      onClose();
    }
  };

  // Popular video sites shortcuts
  const popularSites = [
    { name: 'YouTube', url: 'https://youtube.com' },
    { name: 'Vimeo', url: 'https://vimeo.com' },
    { name: 'Dailymotion', url: 'https://dailymotion.com' },
    { name: 'Streamable', url: 'https://streamable.com' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-darker rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-pink-500/30">
        {/* Header */}
        <div className="bg-dark border-b border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🌐 Web Browser
            <span className="text-xs text-gray-400 font-normal">Browse any website to find videos</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* URL Bar */}
        <div className="bg-dark border-b border-gray-700 p-3">
          <form onSubmit={handleOpenSite} className="flex gap-2">
            <input
              type="text"
              value={browserUrl}
              onChange={(e) => setBrowserUrl(e.target.value)}
              placeholder="Enter website URL (e.g., axy.com, youtube.com, vimeo.com)"
              className="flex-1 px-4 py-2 bg-darker border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg"
            >
              Go
            </button>
            <button
              type="button"
              onClick={handleExtractVideo}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg whitespace-nowrap"
            >
              📹 Use Video URL
            </button>
          </form>

          {/* Popular Sites Shortcuts */}
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Quick:</span>
            {popularSites.map((site) => (
              <button
                key={site.name}
                onClick={() => {
                  setBrowserUrl(site.url);
                  setIframeUrl(site.url);
                }}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
              >
                {site.name}
              </button>
            ))}
          </div>
        </div>

        {/* Browser View */}
        <div className="flex-1 relative bg-black">
          {!iframeUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <div className="text-6xl mb-4">🌐</div>
              <p className="text-lg mb-2">Enter a website URL above to browse</p>
              <p className="text-sm text-gray-500">Find a video, then click "📹 Use Video URL"</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-lg mb-2">Cannot load this website</p>
              <p className="text-sm text-gray-400 max-w-md text-center">{error}</p>
              <p className="text-xs text-gray-500 mt-4">
                Some sites block embedding. Try opening in a new tab instead.
              </p>
            </div>
          ) : (
            <iframe
              src={iframeUrl}
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              onError={() => setError('This website cannot be displayed in an iframe due to security restrictions.')}
              title="Web Browser"
            />
          )}
        </div>

        {/* Instructions Footer */}
        <div className="bg-dark border-t border-gray-700 p-3">
          <div className="text-xs text-gray-400 space-y-1">
            <p>💡 <strong>How to use:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Browse to any video hosting website</li>
              <li>Find the video you want to watch</li>
              <li>Right-click video → "Copy video address" OR copy the page URL</li>
              <li>Click "📹 Use Video URL" button and paste the link</li>
              <li>Video will load in the room player!</li>
            </ol>
            <p className="text-yellow-400 mt-2">
              ⚠️ Note: Some websites block iframe embedding. If you see an error, open the site in a new tab instead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WebBrowser;
