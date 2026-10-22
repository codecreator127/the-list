// Loopback-only development API. Uses live Firebase authentication and configured Cloudinary.
import { createServer } from 'node:http';
import handler from '../api/profile-photo.mjs';
import reviewHandler from '../api/review-photo.mjs';

const port = Number(process.env.UPLOAD_API_PORT ?? 4177);
createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (!['/api/profile-photo','/api/review-photo'].includes(pathname)) {
    res.writeHead(404).end('Not found'); return;
  }
  res.status = code => {res.statusCode=code;return res;};
  res.json = value => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  void (pathname === '/api/review-photo' ? reviewHandler : handler)(req,res);
}).listen(port,'127.0.0.1',()=>console.log(`Local photo API: http://127.0.0.1:${port}/api/profile-photo`));
