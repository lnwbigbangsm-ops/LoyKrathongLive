// ตัวเชื่อม TikTok LIVE -> เกมลอยกระทง
// ใช้:  node bridge.mjs <ชื่อบัญชี TikTok ที่กำลังไลฟ์>     เช่น  node bridge.mjs myshop
//       node bridge.mjs --test                              (ส่งคอมเมนต์จำลองไว้ทดสอบก่อนไลฟ์)
// แล้วเปิดเกมที่  http://localhost:8787
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const arg = (process.argv[2] || '').trim();
const TEST = arg === '--test';
const USER = arg.replace(/^@/, '');

if (!arg) {
  console.log('ใส่ชื่อบัญชีด้วย เช่น:  node bridge.mjs myshop   หรือทดสอบ:  node bridge.mjs --test');
  process.exit(1);
}

/* ---------- เว็บ + WebSocket (เฉพาะเครื่องนี้) ---------- */
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/index.html') || req.url.startsWith('/?')) {
    fs.readFile(path.join(DIR, 'index.html'), (err, buf) => {
      if (err) { res.writeHead(500); res.end('index.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  } else if (/^\/art\/cut\/[\w.-]+\.(png|jpg)$/.test(req.url.split('?')[0])) {
    fs.readFile(path.join(DIR, 'art', 'cut', path.basename(req.url.split('?')[0])), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': req.url.includes('.jpg') ? 'image/jpeg' : 'image/png', 'Cache-Control': 'no-cache' }); res.end(buf);
    });
  } else { res.writeHead(404); res.end(); }
});
const wss = new WebSocketServer({ server });
let status = { type: 'status', state: 'starting', text: 'กำลังเริ่ม…', user: TEST ? 'โหมดทดสอบ' : USER };
function send(obj) {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}
function setStatus(state, text) { status = { ...status, state, text }; console.log('[' + state + '] ' + text); send(status); }
wss.on('connection', ws => ws.send(JSON.stringify(status)));
server.listen(PORT, '127.0.0.1', () => console.log('เปิดเกมที่  http://localhost:' + PORT));

/* ---------- โหมดทดสอบ ---------- */
if (TEST) {
  const names = ['น้องมายด์', 'พี่ต้น', 'Aom_22', 'ลุงหนวด', 'Fah', 'บอส', 'แพรวา', 'Ice.ice'];
  const texts = ['ขอให้สอบติด', 'ขอให้แม่หายป่วยไว ๆ', 'ปีหน้าขอมีแฟน', 'สอยดาว', 'ขอให้รวย ๆ', '555', 'ขอให้ครอบครัวแข็งแรง',
    'สนใจทักไลน์ 0812345678', 'เดือน 12', 'ขอให้ได้งานใหม่', '❤️❤️❤️'];
  let i = 0;
  setStatus('connected', 'โหมดทดสอบ: กำลังส่งคอมเมนต์จำลอง');
  setInterval(() => {
    const n = names[i % names.length];
    send({ type: 'chat', uid: 'test_' + (i % names.length), nick: n, comment: texts[i % texts.length] }); i++;
  }, 2500);
  setInterval(() => send({ type: 'like', uid: 'test_like', nick: 'คนดู', count: 15 }), 1800);
  const gifts = [['พี่ใจดี', 'Rose', 1], ['คุณนุ่น', 'Finger Heart', 30], ['เฮียโต', 'Confetti', 199], ['มาดามแป้ง', 'Galaxy', 1000]];
  let g = 0;
  setInterval(() => { const x = gifts[g++ % gifts.length]; send({ type: 'gift', uid: 'test_' + x[0], nick: x[0], gift: x[1], count: 1, coins: x[2] }); }, 9000);
} else {
  /* ---------- ต่อ TikTok จริง ---------- */
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
  const conn = new TikTokLiveConnection(USER, { processInitialData: false });
  let retry = null, ended = false;
  const who = d => ({ uid: String(d?.user?.uniqueId || d?.user?.userId || ''), nick: String(d?.user?.nickname || d?.user?.uniqueId || 'คนดู') });

  conn.on(WebcastEvent.CHAT, d => { if (d?.comment) send({ type: 'chat', ...who(d), comment: String(d.comment) }); });
  conn.on(WebcastEvent.LIKE, d => send({ type: 'like', ...who(d), count: Number(d?.likeCount || d?.count || 1) }));
  conn.on(WebcastEvent.GIFT, d => {
    if (d?.giftDetails?.giftType === 1 && !d.repeatEnd) return;      // รอให้คอมโบจบก่อน
    const count = Number(d?.repeatCount || 1), each = Number(d?.giftDetails?.diamondCount || d?.diamondCount || 1);
    send({ type: 'gift', ...who(d), gift: String(d?.giftDetails?.giftName || ''), count, coins: each * count });
  });
  conn.on(WebcastEvent.STREAM_END, () => { ended = true; setStatus('ended', 'ไลฟ์จบแล้ว'); });
  conn.on(ControlEvent.DISCONNECTED, () => { if (!ended) { setStatus('retry', 'หลุดการเชื่อมต่อ จะลองใหม่ใน 15 วินาที'); again(15000); } });
  conn.on(ControlEvent.ERROR, e => console.log('[error]', e?.info || '', e?.exception?.message || ''));

  function again(ms) { clearTimeout(retry); retry = setTimeout(connect, ms); }
  async function connect() {
    setStatus('connecting', 'กำลังเชื่อมต่อ @' + USER + ' …');
    try {
      const st = await conn.connect();
      setStatus('connected', 'เชื่อมต่อ @' + USER + ' แล้ว (ห้อง ' + (st?.roomId || '?') + ')');
    } catch (e) {
      const msg = String(e?.message || e);
      setStatus('retry', 'ยังต่อไม่ได้: ' + msg.slice(0, 140) + ' — จะลองใหม่ใน 30 วินาที');
      again(30000);   // เว้นช่วงนาน กันโดนจำกัดความถี่
    }
  }
  connect();
}
