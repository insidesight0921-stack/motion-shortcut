#!/usr/bin/env node
/**
 * Flickey 모의 에이전트 (docs/AGENT-PROTOCOL.md §6).
 * 실제 OS 입력은 하지 않는다. 받은 메시지를 콘솔에 찍고 { ok:true } 로 응답한다.
 *
 *   pnpm mock-agent
 *   pnpm mock-agent -- --port 41777 --deny-accessibility --drop-rate 0.1 --panic-after 20 --platform win32
 */
import { WebSocketServer } from 'ws';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const port = Number(opt('port', 41777));
const denyAccessibility = opt('deny-accessibility', false) === true;
const dropRate = Number(opt('drop-rate', 0));
const panicAfter = Number(opt('panic-after', 0));
const platform = String(opt('platform', process.platform === 'win32' ? 'win32' : 'darwin'));

const capabilities = ['key', 'cursor', 'laser', 'open', 'panel'];
const V = 1;

const wss = new WebSocketServer({ host: '127.0.0.1', port });
const ts = () => new Date().toISOString().slice(11, 23);
console.log(`[mock-agent ${ts()}] listening ws://127.0.0.1:${port}  platform=${platform} accessibility=${!denyAccessibility} dropRate=${dropRate} panicAfter=${panicAfter || '-'}`);

let whitelist = [];

wss.on('connection', (ws) => {
  let count = 0;
  let panicked = false;
  console.log(`[mock-agent ${ts()}] client connected`);
  ws.send(
    JSON.stringify({
      v: V,
      type: 'hello',
      agent: 'flickey-mock-agent/0.1.0',
      platform,
      capabilities,
      permissions: { accessibility: !denyAccessibility, screenRecording: null },
      displays: [{ id: 0, w: 2560, h: 1440, primary: true }],
    }),
  );

  ws.on('message', (data) => {
    const raw = data.toString();
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ v: V, ok: false, error: 'invalid_message', message: 'JSON parse failed' }));
      return;
    }
    count++;
    const compact = JSON.stringify(msg);
    console.log(`[mock-agent ${ts()}] ← ${compact.length > 200 ? compact.slice(0, 200) + '…' : compact}`);

    if (msg.v !== V) {
      ws.send(JSON.stringify({ v: V, id: msg.id, ok: false, error: 'unsupported_version' }));
      return;
    }
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ v: V, type: 'pong', id: msg.id }));
      return;
    }
    if (msg.type === 'whitelist') {
      whitelist = Array.isArray(msg.items) ? msg.items : [];
      ws.send(JSON.stringify({ v: V, id: msg.id, ok: true }));
      return;
    }
    if (panicAfter && count >= panicAfter && !panicked) {
      panicked = true;
      console.log(`[mock-agent ${ts()}] → panic (after ${count} messages)`);
      ws.send(JSON.stringify({ v: V, type: 'panic' }));
    }
    if (panicked) {
      ws.send(JSON.stringify({ v: V, id: msg.id, ok: false, error: 'internal', message: 'panic' }));
      return;
    }
    if (!capabilities.includes(msg.type)) {
      ws.send(JSON.stringify({ v: V, id: msg.id, ok: false, error: 'unsupported_type' }));
      return;
    }
    if ((msg.type === 'key' || msg.type === 'cursor') && denyAccessibility) {
      ws.send(JSON.stringify({ v: V, id: msg.id, ok: false, error: 'accessibility_permission_missing', message: '시스템 설정 › 개인정보 보호 및 보안 › 손쉬운 사용에서 허용하세요' }));
      return;
    }
    if (msg.type === 'open') {
      const t = msg.target ?? {};
      const listed = whitelist.some((w) => w.kind === t.kind && w.value === t.value);
      if (!listed) {
        ws.send(JSON.stringify({ v: V, id: msg.id, ok: false, error: 'not_whitelisted' }));
        return;
      }
    }
    if (msg.ack === false) return; // move 류: 응답 생략
    if (dropRate > 0 && Math.random() < dropRate) {
      console.log(`[mock-agent ${ts()}]   (dropped response for ${msg.id})`);
      return;
    }
    ws.send(JSON.stringify({ v: V, id: msg.id, ok: true }));
  });

  ws.on('close', () => console.log(`[mock-agent ${ts()}] client disconnected`));
});

process.on('SIGINT', () => {
  console.log(`\n[mock-agent ${ts()}] bye`);
  wss.close();
  process.exit(0);
});
