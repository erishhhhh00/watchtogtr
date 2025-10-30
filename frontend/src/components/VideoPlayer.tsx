import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';

/**
 * VideoPlayer Component
 * Implements synchronized playback with drift correction
 * Supports MP4, HLS, YouTube, Google Drive, and Seedr videos
 */

// Helper function to extract video ID from YouTube URL
const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Helper to convert Google Drive link to direct stream URL
const getGoogleDriveDirectUrl = (url: string): string => {
  // Extract file ID from various Google Drive URL formats
  const patterns = [
    /drive\.google\.com\/file\/d\/([^\/]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/,
    /drive\.google\.com\/uc\?id=([^&]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return url;
};

// Helper to get Seedr direct URL
const getSeedrDirectUrl = (url: string): string => {
  // Seedr URLs are typically direct, just ensure they're properly formatted
  if (url.includes('seedr.cc') && !url.includes('/download/')) {
    return url;
  }
  return url;
};

function VideoPlayer() {
  const { room, isHost } = useRoomStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [localTime, setLocalTime] = useState(0);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoType, setVideoType] = useState<'html5' | 'youtube'>('html5');
  const driftCheckInterval = useRef<number>();
  const ytPlayerRef = useRef<any>(null);

  const playbackState = room?.playbackState;

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize YouTube player
  const initYouTubePlayer = (videoId: string) => {
    if (!window.YT || !iframeRef.current) return;

    const onYouTubeIframeAPIReady = () => {
      ytPlayerRef.current = new window.YT.Player(iframeRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: isHost ? 1 : 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setIsLoading(false);
            if (playbackState?.isPlaying) {
              ytPlayerRef.current.playVideo();
            }
            if (playbackState?.currentTime) {
              ytPlayerRef.current.seekTo(playbackState.currentTime, true);
            }
          },
          onStateChange: (event: any) => {
            if (isHost) {
              if (event.data === window.YT.PlayerState.PLAYING && room) {
                socketService.play(room.id);
              } else if (event.data === window.YT.PlayerState.PAUSED && room) {
                const currentTime = ytPlayerRef.current?.getCurrentTime() || 0;
                socketService.pause(room.id, currentTime);
              }
            }
          },
          onError: () => {
            setError('Failed to load YouTube video. Please check the URL.');
            setIsLoading(false);
          },
        },
      });
    };

    if (window.YT.Player) {
      onYouTubeIframeAPIReady();
    } else {
      window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    }
  };

  useEffect(() => {
    if (!playbackState?.url) return;

    const url = playbackState.url;
    
    // Determine video type and process URL
    const youtubeId = getYouTubeVideoId(url);
    
    if (youtubeId) {
      // YouTube video
      setVideoType('youtube');
      setIsLoading(true);
      setError('');
      
      // Destroy existing YouTube player if any
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
      
      // Initialize new YouTube player
      setTimeout(() => initYouTubePlayer(youtubeId), 100);
    } else {
      // HTML5 video (MP4, Google Drive, Seedr, etc.)
      setVideoType('html5');
      
      if (!videoRef.current) return;
      const video = videoRef.current;

      // Process URL based on source
      let processedUrl = url;
      if (url.includes('drive.google.com')) {
        processedUrl = getGoogleDriveDirectUrl(url);
      } else if (url.includes('seedr.cc')) {
        processedUrl = getSeedrDirectUrl(url);
      }

      // Sync video source
      if (video.src !== processedUrl) {
        setIsLoading(true);
        setError('');
        video.src = processedUrl;
        video.load();
        video.currentTime = playbackState.currentTime;
        
        const handleCanPlay = () => {
          setIsLoading(false);
          console.log('Video can play');
        };
        
        const handleError = () => {
          setIsLoading(false);
          setError('Failed to load video. Try using a direct video link (.mp4, .webm, .mkv)');
        };
        
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('error', handleError);
        
        return () => {
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('error', handleError);
        };
      }
    }
  }, [playbackState?.url]);

  // Handle HTML5 video playback state
  useEffect(() => {
    if (videoType !== 'html5' || !playbackState || !videoRef.current) return;

    const video = videoRef.current;

    // Immediate sync: Set video time to expected time
    const expectedTime = socketService.calculateExpectedTime(playbackState);
    const currentDrift = Math.abs(video.currentTime - expectedTime);
    
    if (currentDrift > 0.3) {
      console.log(`Initial sync: correcting ${currentDrift.toFixed(2)}s drift`);
      video.currentTime = expectedTime;
    }

    // Apply playback state immediately
    if (playbackState.isPlaying && video.paused) {
      video.play().catch((err) => {
        console.error('Play error:', err);
        setError('Failed to play video. Click the play button to try again.');
      });
    } else if (!playbackState.isPlaying && !video.paused) {
      video.pause();
    }

    // Faster drift correction (every 500ms instead of 1000ms)
    driftCheckInterval.current = window.setInterval(() => {
      if (!video.paused && playbackState.isPlaying) {
        const expectedTime = socketService.calculateExpectedTime(playbackState);
        const currentTime = video.currentTime;
        const drift = Math.abs(expectedTime - currentTime);

        // Tighter tolerance: 0.3s instead of 0.5s
        if (drift > 0.3) {
          console.log(`Drift detected: ${drift.toFixed(2)}s, resyncing...`);
          video.currentTime = expectedTime;
        }
      }

      setLocalTime(video.currentTime);
    }, 500);

    return () => {
      if (driftCheckInterval.current) {
        clearInterval(driftCheckInterval.current);
      }
    };
  }, [playbackState, videoType]);

  // Handle YouTube video playback state
  useEffect(() => {
    if (videoType !== 'youtube' || !playbackState || !ytPlayerRef.current) return;

    const player = ytPlayerRef.current;

    try {
      // Immediate sync: Set video time to expected time
      const expectedTime = socketService.calculateExpectedTime(playbackState);
      const currentTime = player.getCurrentTime?.() || 0;
      const currentDrift = Math.abs(currentTime - expectedTime);
      
      if (currentDrift > 0.3) {
        console.log(`Initial sync: correcting ${currentDrift.toFixed(2)}s drift`);
        player.seekTo(expectedTime, true);
      }

      // Apply playback state immediately
      if (playbackState.isPlaying) {
        if (player.getPlayerState() !== window.YT.PlayerState.PLAYING) {
          player.playVideo();
        }
      } else {
        if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
          player.pauseVideo();
        }
      }

      // Faster drift correction (every 500ms instead of 1000ms)
      driftCheckInterval.current = window.setInterval(() => {
        if (player.getPlayerState() === window.YT.PlayerState.PLAYING && playbackState.isPlaying) {
          const expectedTime = socketService.calculateExpectedTime(playbackState);
          const currentTime = player.getCurrentTime();
          const drift = Math.abs(expectedTime - currentTime);

          // Tighter tolerance: 0.3s instead of 0.5s
          if (drift > 0.3) {
            console.log(`Drift detected: ${drift.toFixed(2)}s, resyncing...`);
            player.seekTo(expectedTime, true);
          }

          setLocalTime(currentTime);
        }
      }, 500);
    } catch (err) {
      console.error('YouTube player error:', err);
    }

    return () => {
      if (driftCheckInterval.current) {
        clearInterval(driftCheckInterval.current);
      }
    };
  }, [playbackState, videoType]);

  const handlePlay = () => {
    if (isHost && room) {
      socketService.play(room.id);
    }
  };

  const handlePause = () => {
    if (isHost && room && videoRef.current) {
      socketService.pause(room.id, videoRef.current.currentTime);
    }
  };

  const handleSeeked = () => {
    if (isHost && room && videoRef.current) {
      socketService.seek(room.id, videoRef.current.currentTime);
    }
  };

  return (
    <div className="bg-darker rounded-lg overflow-hidden shadow-lg">
      {playbackState?.url ? (
        <div className="relative aspect-video bg-black">
          {videoType === 'youtube' ? (
            <div ref={iframeRef} className="w-full h-full"></div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full"
              controls={isHost}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeeked}
              crossOrigin="anonymous"
            >
              <source src={playbackState.url} />
              Your browser does not support the video tag.
            </video>
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-2"></div>
                <p className="text-white">Loading video...</p>
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="absolute top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-sm z-10">
              ⚠️ {error}
            </div>
          )}
          
          {/* Sync indicator */}
          {!isLoading && (
            <div className="absolute top-2 left-2 bg-black/70 px-3 py-1 rounded text-xs text-white z-10">
              {playbackState.isPlaying ? '▶ Playing' : '⏸ Paused'} | {localTime.toFixed(1)}s
              {videoType === 'youtube' && ' | YouTube'}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-black flex items-center justify-center text-gray-400">
          <div className="text-center px-4">
            <p className="text-2xl mb-3 text-pink-400">💕 Aahana & DEEP 💕</p>
            <p className="text-xl mb-2 font-semibold text-white">Watch With Friends</p>
            <p className="text-lg mb-2">No video loaded</p>
            <p className="text-sm mb-4">Host: Add a video URL below</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>✅ Supports: YouTube, Google Drive, Seedr, Direct MP4/WebM links</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add YouTube API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default VideoPlayer;
