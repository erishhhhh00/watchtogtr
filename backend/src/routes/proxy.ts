import { Router } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
const ffmpegPath = require('ffmpeg-static');

export const proxyRouter = Router();

// Health check endpoint for FFmpeg
proxyRouter.get('/health', (_req, res): void => {
  const ffmpegAvailable = ffmpegPath && existsSync(ffmpegPath);
  res.json({
    ffmpeg: {
      available: ffmpegAvailable,
      path: ffmpegPath || 'not found',
    },
    status: ffmpegAvailable ? 'ok' : 'error',
  });
});

// Allowlist for proxy - now supports many common video hosting sites
const ALLOWED_HOSTS = new Set<string>([
  'drive.google.com',
  'docs.google.com',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'dailymotion.com',
  'streamable.com',
  'seedr.cc',
  'mega.nz',
  'mediafire.com',
  'dropbox.com',
  'box.com',
  'onedrive.live.com',
  '1drv.ms',
  'wetransfer.com',
  'gofile.io',
  // Streamtape domains
  'streamtape.com',
  'streamtape.net',
  'streamtape.to',
  'streamta.pe',
  'strtape.tech',
  'strtpe.link',
  'strcloud.link',
  'strtapeadblock.club',
  'stape.fun',
  // Other video hosts
  'doodstream.com',
  'dood.to',
  'dood.la',
  'dood.ws',
  'mixdrop.co',
  'mixdrop.to',
  'mixdrop.sx',
  'terabox.com',
  // Add common CDNs and video platforms
  'cloudflare.com',
  'akamai.net',
  'fastly.net',
  'amazonaws.com',
  'cloudfront.net',
]);

function isAllowed(target: URL) {
  if (ALLOWED_HOSTS.has(target.hostname)) return true;
  
  // Allow common patterns
  // *.googleusercontent.com
  if (/\.googleusercontent\.com$/i.test(target.hostname)) return true;
  // *.googleapis.com
  if (/\.googleapis\.com$/i.test(target.hostname)) return true;
  // *.gvt1.com (Google video)
  if (/\.gvt1\.com$/i.test(target.hostname)) return true;
  // Any .mp4, .webm, .mkv, .m3u8 direct file URLs from any domain
  if (/\.(mp4|webm|mkv|avi|mov|flv|m3u8|ts)(\?|$)/i.test(target.pathname)) return true;
  
  // For security: block localhost, private IPs, and file:// protocols
  if (/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(target.hostname)) return false;
  
  return false;
}

proxyRouter.get('/video', (req, res): void => {
  const raw = (req.query.url as string) || '';
  if (!raw) { res.status(400).json({ message: 'Missing url parameter' }); return; }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    res.status(400).json({ message: 'Invalid URL' });
    return;
  }

  if (!/^https?:$/i.test(target.protocol)) {
    res.status(400).json({ message: 'Only http/https URLs are allowed' });
    return;
  }

  if (!isAllowed(target)) {
    res.status(403).json({ message: 'URL host not allowed by proxy' });
    return;
  }

  const client = target.protocol === 'http:' ? http : https;

  const headers: Record<string, string> = {
    'User-Agent': req.headers['user-agent'] as string || 'Mozilla/5.0',
    'Accept': req.headers['accept'] as string || '*/*',
    'Range': (req.headers['range'] as string) || '',
    'Referer': 'https://drive.google.com/',
  };
  if (!headers['Range']) delete headers['Range'];

  const options: https.RequestOptions = {
    method: 'GET',
    headers,
  };

  const upstream = client.request(target, options, (upstreamRes) => {
    // If Google Drive returns an HTML warning page (for large files), capture and follow the confirm link
    const isDrive = /drive\.google\.com$/i.test(target.hostname) || /googleusercontent\.com$/i.test(target.hostname);

    if (isDrive && (upstreamRes.headers['content-type'] || '').includes('text/html')) {
      // Buffer small HTML response to inspect for confirm token
      const chunks: Buffer[] = [];
      upstreamRes.on('data', (c: Buffer) => chunks.push(c));
      upstreamRes.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        // Try to find a confirm token in the HTML (pattern appears in Drive interstitial)
        const m = body.match(/confirm=([0-9A-Za-z_\-]+)/i) || body.match(/confirm=([0-9A-Za-z_\-]+)&/i);
        if (m && m[1]) {
          const token = m[1];
          // Reconstruct URL with confirm token
          const confirmed = new URL(target.toString());
          confirmed.searchParams.set('confirm', token);
          // Re-request the confirmed URL
          const client2 = confirmed.protocol === 'http:' ? http : https;
          const req2 = client2.request(confirmed, options, (r2) => {
            const passthroughHeaders: Record<string, string | number | readonly string[] | undefined> = {
              'Content-Type': r2.headers['content-type'],
              'Content-Length': r2.headers['content-length'],
              'Content-Range': r2.headers['content-range'],
              'Accept-Ranges': r2.headers['accept-ranges'] || 'bytes',
              'Cache-Control': r2.headers['cache-control'] || 'no-cache',
            };
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges');
            res.status(r2.statusCode || 200);
            Object.entries(passthroughHeaders).forEach(([k, v]) => { if (typeof v !== 'undefined') res.setHeader(k, v as any); });
            r2.pipe(res);
          });
          req2.on('error', (err) => { if (!res.headersSent) res.status(502).json({ message: 'Upstream fetch failed', error: String(err) }); else try { res.end(); } catch {} });
          req2.end();
          return;
        }

        // If no confirm token, fall back to returning the original HTML (likely an error)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges');
        res.status(upstreamRes.statusCode || 200).send(body);
      });
      upstreamRes.on('error', (err) => { if (!res.headersSent) res.status(502).json({ message: 'Upstream fetch failed', error: String(err) }); });
      return;
    }

    // Pass through relevant headers
    const passthroughHeaders: Record<string, string | number | readonly string[] | undefined> = {
      'Content-Type': upstreamRes.headers['content-type'],
      'Content-Length': upstreamRes.headers['content-length'],
      'Content-Range': upstreamRes.headers['content-range'],
      'Accept-Ranges': upstreamRes.headers['accept-ranges'] || 'bytes',
      'Cache-Control': upstreamRes.headers['cache-control'] || 'no-cache',
    };

    // Always allow cross-origin reads from the frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges');

    // Some upstreams return 206 for ranged responses; preserve status code
    res.status(upstreamRes.statusCode || 200);
    Object.entries(passthroughHeaders).forEach(([k, v]) => {
      if (typeof v !== 'undefined') res.setHeader(k, v as any);
    });
    upstreamRes.pipe(res);
  });

  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ message: 'Upstream fetch failed', error: String(err) });
    } else {
      try { res.end(); } catch {}
    }
  });

  upstream.end();
});

// Transcode/Transmux endpoint: streams as MP4 for broader browser support
// NOTE: This is a best-effort pipe; seeking support is limited when piping.
proxyRouter.get('/transcode', (req, res): void => {
  const raw = (req.query.url as string) || '';
  if (!raw) { res.status(400).json({ message: 'Missing url parameter' }); return; }

  let target: URL;
  try { target = new URL(raw); } catch { res.status(400).json({ message: 'Invalid URL' }); return; }
  if (!/^https?:$/i.test(target.protocol)) { res.status(400).json({ message: 'Only http/https URLs are allowed' }); return; }
  if (!isAllowed(target)) { res.status(403).json({ message: 'URL host not allowed by proxy' }); return; }

  if (!ffmpegPath) { 
    console.error('[Transcode] FFmpeg not available');
    res.status(500).json({ message: 'FFmpeg binary not available on server' }); 
    return; 
  }

  console.log('[Transcode] Starting transcode for:', raw);
  console.log('[Transcode] FFmpeg path:', ffmpegPath);

  // For Google Drive, first check if we need a confirm token
  const isDrive = /drive\.google\.com|googleusercontent\.com/i.test(target.hostname);
  
  if (isDrive && raw.includes('export=download')) {
    // Try to fetch and check for confirm token
    const client = target.protocol === 'http:' ? http : https;
    const checkReq = client.request(target, { method: 'HEAD' }, (checkRes) => {
      const contentType = checkRes.headers['content-type'] || '';
      
      // If HTML response, we likely need a confirm token
      if (contentType.includes('text/html')) {
        console.log('[Transcode] Drive returned HTML, fetching confirm token...');
        
        const fetchReq = client.request(target, { method: 'GET' }, (fetchRes) => {
          const chunks: Buffer[] = [];
          fetchRes.on('data', (c: Buffer) => chunks.push(c));
          fetchRes.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const m = body.match(/confirm=([0-9A-Za-z_\-]+)/i);
            
            if (m && m[1]) {
              const confirmed = new URL(raw);
              confirmed.searchParams.set('confirm', m[1]);
              console.log('[Transcode] Found confirm token, restarting with:', confirmed.toString());
              
              // Restart transcode with confirmed URL
              startTranscode(confirmed.toString(), res);
              return;
            }
            
            console.error('[Transcode] No confirm token found, proceeding anyway');
            startTranscode(raw, res);
          });
        });
        
        fetchReq.on('error', (err) => {
          console.error('[Transcode] Error fetching confirm token:', err);
          startTranscode(raw, res);
        });
        
        fetchReq.end();
        return;
      }
      
      // Direct video file, proceed
      startTranscode(raw, res);
    });
    
    checkReq.on('error', (err) => {
      console.error('[Transcode] HEAD request error:', err);
      startTranscode(raw, res);
    });
    
    checkReq.end();
    return;
  }
  
  // Non-Drive or already has token
  startTranscode(raw, res);
  
  function startTranscode(videoUrl: string, response: any) {
    console.log('[Transcode] Starting FFmpeg with URL:', videoUrl);
    
    const headers = [
      `User-Agent: Mozilla/5.0`,
      `Referer: https://drive.google.com/`,
      `Accept: */*`,
    ];

    const inputArgs = [
      '-hide_banner', '-loglevel', 'warning',
      '-headers', headers.map(h => h + '\r\n').join(''),
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_on_network_error', '1',
      '-i', videoUrl,
    ];

    const outputArgs = [
      // Re-encode to H.264/AAC for universal browser support
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      // Make it streamable fragmented MP4
      '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+faststart',
      '-reset_timestamps', '1',
      'pipe:1',
    ];

    response.setHeader('Content-Type', 'video/mp4');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Access-Control-Allow-Origin', '*');

    const ff = spawn(ffmpegPath as string, [...inputArgs, ...outputArgs]);

    ff.stdout.pipe(response);

    let errorMsg = '';
    ff.stderr.on('data', (d) => { 
      errorMsg += d.toString();
      console.error('[Transcode] FFmpeg stderr:', d.toString().slice(0, 200));
    });

    const cleanup = () => {
      try { ff.kill('SIGKILL'); } catch {}
    };
    
    response.on('close', () => {
      console.log('[Transcode] Client disconnected');
      cleanup();
    });
    
    response.on('error', (err: any) => {
      console.error('[Transcode] Response error:', err);
      cleanup();
    });

    ff.on('error', (err) => {
      console.error('[Transcode] FFmpeg spawn error:', err);
      if (!response.headersSent) {
        response.status(500).json({ message: 'FFmpeg failed to start', error: String(err) });
      }
      cleanup();
    });

    ff.on('close', (code) => {
      console.log('[Transcode] FFmpeg exited with code:', code);
      if (code !== 0 && !response.headersSent) {
        console.error('[Transcode] Error details:', errorMsg.slice(0, 1000));
        response.status(502).json({ message: 'Transcode failed', detail: errorMsg.slice(0, 1000) });
      }
      try { response.end(); } catch {}
    });
  }
});

// Streamtape API integration - get video info
proxyRouter.get('/streamtape/info', async (req, res): Promise<void> => {
  const videoUrl = (req.query.url as string) || '';
  
  if (!videoUrl) {
    res.status(400).json({ message: 'Missing url parameter' });
    return;
  }

  // Extract video ID from Streamtape URL
  const patterns = [
    /streamtape\.com\/v\/([a-zA-Z0-9_-]+)/,
    /streamtape\.com\/e\/([a-zA-Z0-9_-]+)/,
    /streamta\.pe\/([a-zA-Z0-9_-]+)/,
    /strtape\.tech\/v\/([a-zA-Z0-9_-]+)/,
    /stape\.fun\/v\/([a-zA-Z0-9_-]+)/,
  ];

  let videoId = '';
  for (const pattern of patterns) {
    const match = videoUrl.match(pattern);
    if (match) {
      videoId = match[1];
      break;
    }
  }

  if (!videoId) {
    res.status(400).json({ message: 'Invalid Streamtape URL' });
    return;
  }

  try {
    // Try to fetch the embed page to extract video info
    const embedUrl = `https://streamtape.com/e/${videoId}`;
    
    const response = await new Promise<{ title: string; videoUrl: string }>((resolve, reject) => {
      https.get(embedUrl, (embedRes) => {
        let html = '';
        embedRes.on('data', (chunk) => { html += chunk; });
        embedRes.on('end', () => {
          // Extract title from HTML
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1].replace(' - Streamtape', '').trim() : `Video ${videoId}`;
          
          // Extract direct video URL from the page
          const videoMatch = html.match(/getElementById\('videolink'\)\.innerHTML\s*=\s*["']([^"']+)["']\s*\+\s*["']([^"']+)["']/);
          let directVideoUrl = '';
          
          if (videoMatch) {
            const baseUrl = videoMatch[1];
            const token = videoMatch[2];
            directVideoUrl = `https:${baseUrl}${token}`;
          } else {
            // Fallback: use the embed URL
            directVideoUrl = embedUrl;
          }

          resolve({ title, videoUrl: directVideoUrl });
        });
      }).on('error', reject);
    });

    res.json({
      id: videoId,
      title: response.title,
      videoUrl: response.videoUrl,
      embedUrl: embedUrl,
      proxyUrl: `${req.protocol}://${req.get('host')}/api/proxy/video?url=${encodeURIComponent(response.videoUrl)}`,
    });
  } catch (error) {
    console.error('[Streamtape API] Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch Streamtape video info',
      error: String(error),
    });
  }
});
