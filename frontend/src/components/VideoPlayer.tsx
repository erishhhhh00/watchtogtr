import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
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

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

// Helper to convert Google Drive link to proxied direct stream URL
const getGoogleDriveDirectUrl = (url: string, forceTranscode?: boolean): string => {
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
      const direct = `https://drive.google.com/uc?export=download&id=${fileId}`;
      
      // If forceTranscode or URL suggests MKV, use transcode endpoint immediately
      if (forceTranscode || /\.mkv/i.test(url)) {
        console.log('[VideoPlayer] Using transcode endpoint for Drive MKV');
        return `${API_URL}/api/proxy/transcode?url=${encodeURIComponent(direct)}`;
      }
      
      // Otherwise try proxy first
      return `${API_URL}/api/proxy/video?url=${encodeURIComponent(direct)}`;
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

// Helper to proxy any external video URL through backend
const getProxiedUrl = (url: string): string => {
  // If it's already a proxied URL, return as-is
  if (url.includes('/api/proxy/')) {
    return url;
  }
  
  // Check if URL needs proxying (external sources like Streamtape, Doodstream, etc.)
  const needsProxy = [
    'streamtape.com', 'streamtape.net', 'strtape.tech', 'stape.fun',
    'doodstream.com', 'dood.to', 'dood.la',
    'mixdrop.co', 'mixdrop.to',
    'terabox.com',
    'mega.nz',
    'mediafire.com',
  ].some(host => url.includes(host));
  
  if (needsProxy) {
    return `${API_URL}/api/proxy/video?url=${encodeURIComponent(url)}`;
  }
  
  return url;
};

// Helper to fetch Streamtape direct video URL via API
const getStreamtapeDirectUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/api/proxy/streamtape/info?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch Streamtape video info');
    }
    const data = await response.json();
    // Return the proxy URL which contains the direct video URL
    return data.proxyUrl || data.videoUrl || url;
  } catch (error) {
    console.error('[VideoPlayer] Streamtape API error:', error);
    // Fallback to original URL
    return url;
  }
};

function VideoPlayer() {
  const { room, isHost } = useRoomStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [localTime, setLocalTime] = useState(0);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoType, setVideoType] = useState<'html5' | 'youtube' | 'hls'>('html5');
  const driftCheckInterval = useRef<number>();
  const ytPlayerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isBufferingRef = useRef<boolean>(false);
  const lastHardSeekAtRef = useRef<number>(0);
  const scheduleTimerRef = useRef<number>();
  const driveTranscodeTriedRef = useRef<boolean>(false);

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
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setIsLoading(false);
            try {
              if (!isHost) {
                // Improve chance of autoplay on guests
                ytPlayerRef.current.mute();
              }
              const start = playbackState?.currentTime || 0;
              const shouldPlay = !!playbackState?.isPlaying;
              const parsedId = getYouTubeVideoId(playbackState?.url || '') || videoId;
              if (parsedId) {
                // Load by ID to be safe, then play/pause based on state
                ytPlayerRef.current.loadVideoById({ videoId: parsedId, startSeconds: start, suggestedQuality: 'auto' });
                if (!shouldPlay) {
                  ytPlayerRef.current.pauseVideo();
                }
              } else if (playbackState?.url) {
                // Correct API signature: use object for mediaContentUrl
                ytPlayerRef.current.loadVideoByUrl({ mediaContentUrl: playbackState.url, startSeconds: start, suggestedQuality: 'auto' });
                if (!shouldPlay) {
                  ytPlayerRef.current.pauseVideo();
                }
              }
            } catch {}
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsLoading(false);
            }
            if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.CUED) {
              setIsLoading(false);
            }
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

  // Cleanup YouTube player on unmount to avoid stale instances
  useEffect(() => {
    return () => {
      try {
        if (ytPlayerRef.current) {
          ytPlayerRef.current.destroy();
          ytPlayerRef.current = null;
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!playbackState?.url) return;

    const url = playbackState.url;
    const declaredType = playbackState.videoType;
    
    // Determine video type and process URL
    const youtubeId = declaredType === 'youtube' ? (getYouTubeVideoId(url) || 'force') : getYouTubeVideoId(url);
    const isHls = declaredType === 'hls' || /\.m3u8(\?|$)/i.test(url);
    
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
      setTimeout(() => {
        // If we used 'force' due to declaredType, extract again safely
        const id = youtubeId === 'force' ? (getYouTubeVideoId(url) || '') : youtubeId;
        initYouTubePlayer(id);
      }, 100);
    } else if (isHls) {
      // HLS stream
      setVideoType('hls');
      setError('');
      setIsLoading(true);
      if (!videoRef.current) return;
      const video = videoRef.current;

      // Clean up existing HLS if any
      try { hlsRef.current?.destroy(); } catch {}
      hlsRef.current = null;

      const useNative = video.canPlayType('application/vnd.apple.mpegURL');
      const setupListeners = () => {
        const handleCanPlay = () => { setIsLoading(false); isBufferingRef.current = false; };
        const handleError = () => { setIsLoading(false); setError('Failed to load HLS stream (.m3u8).'); };
        const handleWaiting = () => { isBufferingRef.current = true; };
        const handlePlaying = () => { isBufferingRef.current = false; };
        const handleStalled = () => { isBufferingRef.current = true; };
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('error', handleError);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('stalled', handleStalled);
        return () => {
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('error', handleError);
          video.removeEventListener('waiting', handleWaiting);
          video.removeEventListener('playing', handlePlaying);
          video.removeEventListener('stalled', handleStalled);
        };
      };

      let cleanup: (() => void) | undefined;

      if (useNative) {
        // Safari / iOS: native HLS
        video.src = url;
        video.load();
        video.currentTime = playbackState.currentTime;
        cleanup = setupListeners();
      } else if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60,
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_e, data) => {
          // FATAL errors require recovery or destroy
          if (data.fatal) {
            try {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  hlsRef.current = null;
                  setError('⚠️ Failed to load HLS stream (.m3u8).');
                  setIsLoading(false);
                  break;
              }
            } catch {}
          }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        video.currentTime = playbackState.currentTime;
        cleanup = setupListeners();
      } else {
        setIsLoading(false);
        setError('HLS not supported in this browser. Try a direct MP4/WebM link.');
      }

      return () => {
        if (cleanup) cleanup();
        try { hlsRef.current?.destroy(); } catch {}
        hlsRef.current = null;
      };
    } else {
      // HTML5 video (MP4, Google Drive, Seedr, etc.)
      setVideoType('html5');
      
      if (!videoRef.current) return;
      const video = videoRef.current;

      // Process URL based on source
      const processUrl = async () => {
        let processedUrl = url;
        
        // Check if it's a Streamtape embed URL
        const isStreamtapeEmbed = /streamtape\.com\/(e|v)\//.test(url);
        
        if (url.includes('drive.google.com')) {
          driveTranscodeTriedRef.current = false;
          // Check if URL contains .mkv in the file name
          const isMKV = /\.mkv/i.test(url);
          if (isMKV) {
            console.log('[VideoPlayer] Detected MKV file, using transcode from start');
            setError('🔄 Transcoding MKV file for browser playback...');
          }
          processedUrl = getGoogleDriveDirectUrl(url, isMKV);
        } else if (isStreamtapeEmbed) {
          // Streamtape embed URL - fetch actual video URL via API
          console.log('[VideoPlayer] Detected Streamtape embed, fetching direct URL...');
          setError('🔄 Loading Streamtape video...');
          setIsLoading(true);
          processedUrl = await getStreamtapeDirectUrl(url);
          console.log('[VideoPlayer] Got Streamtape URL:', processedUrl);
        } else if (url.includes('seedr.cc')) {
          processedUrl = getSeedrDirectUrl(url);
        } else {
          // For other sources (Doodstream, Mixdrop, etc.), use proxy
          processedUrl = getProxiedUrl(url);
        }

        // Sync video source
        if (video.src !== processedUrl) {
          setIsLoading(true);
          if (!url.includes('.mkv') && !isStreamtapeEmbed) {
            setError(''); // Only clear error if not MKV/Streamtape (keep loading message)
          }
          video.src = processedUrl;
          video.load();
          video.currentTime = playbackState.currentTime;
        }
      };

      processUrl();
        
        const handleCanPlay = () => {
          setIsLoading(false);
          setError(''); // Clear any transcode/loading messages
          console.log('Video can play');
          isBufferingRef.current = false;
        };
        
        const handleError = () => {
          setIsLoading(false);
          console.error('[VideoPlayer] Video error:', video.error);
          // Fallback: if Google Drive and not yet transcoded, retry via backend transcode
          if ((url.includes('drive.google.com') || url.includes('googleusercontent.com')) && !driveTranscodeTriedRef.current) {
            driveTranscodeTriedRef.current = true;
            // Build the original direct URL and then request transcode
            let directUrl = url;
            const patterns = [
              /drive\.google\.com\/file\/d\/([^\/]+)/,
              /drive\.google\.com\/open\?id=([^&]+)/,
              /drive\.google\.com\/uc\?id=([^&]+)/,
            ];
            for (const p of patterns) {
              const m = url.match(p);
              if (m) { directUrl = `https://drive.google.com/uc?export=download&id=${m[1]}`; break; }
            }
            const transcodeUrl = `${API_URL}/api/proxy/transcode?url=${encodeURIComponent(directUrl)}`;
            console.log('[VideoPlayer] Direct playback failed, retrying via transcode:', transcodeUrl);
            setError('🔄 Converting MKV to browser-compatible format...');
            setIsLoading(true);
            video.src = transcodeUrl;
            video.load();
            return;
          }
          // Show specific error based on video error code
          const errorCode = video.error?.code;
          const errorMsg = video.error?.message || 'Unknown error';
          console.error('[VideoPlayer] Final error - Code:', errorCode, 'Message:', errorMsg);
          setError(`⚠️ Failed to load video. ${url.includes('.m3u8') ? 'HLS stream error.' : 'Try a different video format or check the URL.'}`);
        };
        const handleWaiting = () => {
          isBufferingRef.current = true;
        };
        const handlePlaying = () => {
          isBufferingRef.current = false;
        };
        const handleStalled = () => {
          isBufferingRef.current = true;
        };
        
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('error', handleError);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('stalled', handleStalled);
        
        return () => {
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('error', handleError);
          video.removeEventListener('waiting', handleWaiting);
          video.removeEventListener('playing', handlePlaying);
          video.removeEventListener('stalled', handleStalled);
        };
      }
    }
  }, [playbackState?.url]);

  // Handle HTML5 video playback state
  useEffect(() => {
    if (videoType !== 'html5' || !playbackState || !videoRef.current) return;

    const video = videoRef.current;
    // Ensure guests are muted to satisfy autoplay policies
    if (!isHost && !video.muted) video.muted = true;

    // Gentle initial sync: only hard-seek if drift is large (>1.0s) and not buffering
    const expectedTime = socketService.calculateExpectedTime(playbackState);
    const initialDrift = expectedTime - video.currentTime;
    if (Math.abs(initialDrift) > 1.0 && !isBufferingRef.current && video.readyState >= 3) {
      console.log(`Initial sync: hard-correcting ${Math.abs(initialDrift).toFixed(2)}s drift`);
      video.currentTime = expectedTime;
      lastHardSeekAtRef.current = Date.now();
    }

    // Clear any earlier schedule
    if (scheduleTimerRef.current) {
      clearTimeout(scheduleTimerRef.current);
      scheduleTimerRef.current = undefined as any;
    }

    // Schedule play/pause to the server-defined moment (nearly simultaneous start)
    const serverNow = socketService.getServerTime();
    const scheduleAt = playbackState.lastUpdated || 0; // server timestamp
    const delayMs = scheduleAt > serverNow ? scheduleAt - serverNow : 0;

    if (playbackState.isPlaying) {
      const playAction = () => {
        if (video.paused) {
          video.play().catch((err) => {
            console.error('Play error:', err);
            setError('Failed to play video. Click the play button to try again.');
          });
        }
      };
      if (delayMs > 0) scheduleTimerRef.current = window.setTimeout(playAction, delayMs);
      else playAction();
    } else {
      const pauseAction = () => {
        if (!video.paused) video.pause();
      };
      if (delayMs > 0) scheduleTimerRef.current = window.setTimeout(pauseAction, delayMs);
      else pauseAction();
    }

    // Adaptive drift correction (every 1000ms)
    driftCheckInterval.current = window.setInterval(() => {
      if (!video.paused && playbackState.isPlaying) {
        const expected = socketService.calculateExpectedTime(playbackState);
        const current = video.currentTime;
        const drift = expected - current; // positive = we're behind

        // Skip corrections while buffering
        if (isBufferingRef.current) {
          setLocalTime(current);
          return;
        }

        const now = Date.now();
        // Large drift → hard seek but no more often than every 2s
        if (Math.abs(drift) > 1.5 && video.readyState >= 3 && now - lastHardSeekAtRef.current > 2000) {
          console.log(`Hard resync: drift ${drift.toFixed(2)}s`);
          video.currentTime = expected;
          video.playbackRate = 1.0;
          lastHardSeekAtRef.current = now;
        } else if (Math.abs(drift) > 0.3 && Math.abs(drift) <= 1.5) {
          // Moderate drift → gently speed up or slow down
          const desired = 1 + Math.max(-0.1, Math.min(0.1, (drift > 0 ? 0.08 : -0.08)));
          if (Math.abs(video.playbackRate - desired) > 0.01) {
            video.playbackRate = desired;
          }
        } else {
          // In sync → normalize rate
          if (Math.abs(video.playbackRate - 1.0) > 0.01) {
            video.playbackRate = 1.0;
          }
        }
      }

      setLocalTime(video.currentTime);
    }, 1000);

    return () => {
      if (driftCheckInterval.current) {
        clearInterval(driftCheckInterval.current);
      }
      // Reset playback rate when effect cleans up
      if (video) video.playbackRate = 1.0;
      if (scheduleTimerRef.current) {
        clearTimeout(scheduleTimerRef.current);
        scheduleTimerRef.current = undefined as any;
      }
    };
  }, [playbackState, videoType]);

  // Handle YouTube video playback state
  useEffect(() => {
    if (videoType !== 'youtube' || !playbackState || !ytPlayerRef.current) return;

    const player = ytPlayerRef.current;

    try {
      // For guests, keep YT muted to ensure programmatic play works
      if (!isHost && player.mute) {
        try { player.mute(); } catch {}
      }
      // Gentle initial sync for YT: only hard seek if >1.2s
      const expectedTime = socketService.calculateExpectedTime(playbackState);
      const currentTime = player.getCurrentTime?.() || 0;
      const initialDrift = expectedTime - currentTime;
      if (Math.abs(initialDrift) > 1.2) {
        console.log(`Initial YT sync: hard-correcting ${Math.abs(initialDrift).toFixed(2)}s drift`);
        player.seekTo(expectedTime, true);
        lastHardSeekAtRef.current = Date.now();
      }

      // Clear earlier schedule
      if (scheduleTimerRef.current) {
        clearTimeout(scheduleTimerRef.current);
        scheduleTimerRef.current = undefined as any;
      }

      // Apply playback state with scheduling to reduce perceived delay
      const serverNow = socketService.getServerTime();
      const scheduleAt = playbackState.lastUpdated || 0; // server timestamp
      const delayMs = scheduleAt > serverNow ? scheduleAt - serverNow : 0;

      if (playbackState.isPlaying) {
        const playAction = () => {
          if (player.getPlayerState() !== window.YT.PlayerState.PLAYING) player.playVideo();
        };
        if (delayMs > 0) scheduleTimerRef.current = window.setTimeout(playAction, delayMs);
        else playAction();
      } else {
        const pauseAction = () => {
          if (player.getPlayerState() === window.YT.PlayerState.PLAYING) player.pauseVideo();
        };
        if (delayMs > 0) scheduleTimerRef.current = window.setTimeout(pauseAction, delayMs);
        else pauseAction();
      }

      // Conservative drift correction for YT (every 1500ms)
      driftCheckInterval.current = window.setInterval(() => {
        if (player.getPlayerState() === window.YT.PlayerState.PLAYING && playbackState.isPlaying) {
          const expectedTime = socketService.calculateExpectedTime(playbackState);
          const currentTime = player.getCurrentTime();
          const drift = expectedTime - currentTime; // positive = behind

          // If buffer is low, avoid any seeks; let YT buffer up
          const loadedFrac = player.getVideoLoadedFraction ? player.getVideoLoadedFraction() : 1;
          if (loadedFrac < 0.2) {
            setLocalTime(currentTime);
            return;
          }

          const now = Date.now();
          if (Math.abs(drift) > 1.5 && now - lastHardSeekAtRef.current > 3000) {
            console.log(`YT hard resync: drift ${drift.toFixed(2)}s`);
            player.seekTo(expectedTime, true);
            lastHardSeekAtRef.current = now;
          }

          setLocalTime(currentTime);
        }
      }, 1500);
    } catch (err) {
      console.error('YouTube player error:', err);
    }

    return () => {
      if (driftCheckInterval.current) {
        clearInterval(driftCheckInterval.current);
      }
      if (scheduleTimerRef.current) {
        clearTimeout(scheduleTimerRef.current);
        scheduleTimerRef.current = undefined as any;
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
              muted={!isHost}
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
