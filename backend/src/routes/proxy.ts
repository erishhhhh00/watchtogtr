import { Router } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

export const proxyRouter = Router();

// Very small allowlist to avoid open proxy misuse
const ALLOWED_HOSTS = new Set<string>([
  'drive.google.com',
  'docs.google.com',
  // After Google redirects, files are served from *.googleusercontent.com
  // We'll allow these hosts generically.
]);

function isAllowed(target: URL) {
  if (ALLOWED_HOSTS.has(target.hostname)) return true;
  // Allow *.googleusercontent.com
  if (/\.googleusercontent\.com$/i.test(target.hostname)) return true;
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

  if (!ffmpegPath) { res.status(500).json({ message: 'FFmpeg binary not available on server' }); return; }

  // Build FFmpeg args. First attempt stream-copy to MP4; if it fails, user can retry or we could later add a fallback.
  const headers = [
    `User-Agent: Mozilla/5.0`,
    `Referer: https://drive.google.com/`,
    `Accept: */*`,
  ];

  const inputArgs = [
    '-hide_banner', '-loglevel', 'error',
    '-headers', headers.map(h => h + '\r\n').join(''),
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_on_network_error', '1',
    '-i', raw,
  ];

  const outputArgs = [
    // Try to transmux (copy) first; many WEB-DL MKVs are H.264/AAC already.
    '-c:v', 'copy', '-c:a', 'aac', '-strict', 'experimental',
    // Make it streamable fragmented MP4
    '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+faststart',
    '-reset_timestamps', '1',
    'pipe:1',
  ];

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ff = spawn(ffmpegPath as string, [...inputArgs, ...outputArgs]);

  ff.stdout.pipe(res);

  let errorMsg = '';
  ff.stderr.on('data', (d) => { errorMsg += d.toString(); });

  const cleanup = () => {
    try { ff.kill('SIGKILL'); } catch {}
  };
  res.on('close', cleanup);
  res.on('error', cleanup);

  ff.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ message: 'FFmpeg failed to start' });
    }
    cleanup();
  });

  ff.on('close', (code) => {
    if (code !== 0 && !res.headersSent) {
      res.status(502).json({ message: 'Transcode failed', detail: errorMsg.slice(0, 1000) });
    }
    try { res.end(); } catch {}
  });
});
