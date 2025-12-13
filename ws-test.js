const WebSocket = require('ws');
const token = process.env.TOKEN || 'ITJh51_82kuB7Ov3uG3XZQ';
const host = process.env.HOST || '192.168.0.21';
const port = process.env.PORT || '5001';
const url = `ws://${host}:${port}/ws?role=device&token=${encodeURIComponent(token)}`;

console.log('Connecting to', url);
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('OPEN');
  const payload = { event: 'device:register', payload: { token } };
  ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
  try { console.log('MSG:', data.toString()); } catch { console.log('MSG (binary)'); }
});

ws.on('error', (e) => {
  console.log('ERR:', e && (e.message || e.toString()));
});

ws.on('close', (code, reason) => {
  console.log('CLOSE:', code, reason ? reason.toString() : '');
});
