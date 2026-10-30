// Test file server: Range support, and each response is paced to `lineRate`
// so localhost behaves like a real internet link. Writes respect socket
// backpressure, so a paused Chrome download stalls the sender like it would
// a real server.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';

export function startServer({ file, lineRate }) {
  const size = statSync(file).size;
  let linkFreeAt = 0;
  const server = http.createServer((req, res) => {
    let start = 0;
    let end = size - 1;
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    const headers = {
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `attachment; filename="${new URL(req.url, 'http://x').searchParams.get('name') ?? 'test.bin'}"`,
      'Cache-Control': 'no-store',
    };
    if (m) {
      start = m[1] ? Number(m[1]) : 0;
      end = m[2] ? Number(m[2]) : size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': size });
    }
    server.ranges.push({ url: req.url, start });
    const name = new URL(req.url, 'http://x').searchParams.get('name') ?? 'test.bin';
    const stream = createReadStream(file, { start, end, highWaterMark: 64 * 1024 });
    stream.on('data', (chunk) => {
      stream.pause();
      const ok = res.write(chunk);
      server.sent[name] = (server.sent[name] ?? 0) + chunk.length;
      // One shared link: each chunk occupies it for chunk/lineRate. Idle
      // time is not banked, so there is no catch-up burst after a stall.
      const now = Date.now();
      linkFreeAt = Math.max(now, linkFreeAt) + (chunk.length / lineRate) * 1000;
      const wait = linkFreeAt - now;
      const go = () => setTimeout(() => stream.resume(), wait);
      if (ok) go();
      else res.once('drain', go);
    });
    stream.on('end', () => res.end());
    res.on('close', () => stream.destroy());
  });
  server.ranges = [];
  server.sent = {}; // name -> bytes written, ground truth for tests

  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
