/* eslint-disable no-console */
import WebSocket from 'ws';
import { buildApp } from '../src/app';
import { env } from '../src/config/env';
import { getRepository } from '../src/models/db';
import {
  ClientMessage,
  CreateSessionResponse,
  ServerMessage,
  WsMessageType,
} from '@voice2spec/shared-types';

/**
 * End-to-end smoke test of the live pipeline against the in-memory/mock stack.
 * Boots the server, creates a session over REST, streams fake audio chunks over
 * the WebSocket, prints the live transcript + translations, then stops and
 * prints the generated spec. Run with: `pnpm --filter server ws:smoke`.
 */
async function main(): Promise<void> {
  await getRepository();
  const app = await buildApp();
  const port = env.PORT + 1; // avoid clashing with a running dev server
  await app.listen({ port, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${port}`;

  // 1) Create a session.
  const createRes = await fetch(`${base}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'smoke-user', zeroRetention: false }),
  });
  const { session } = (await createRes.json()) as CreateSessionResponse;
  console.log(`\n● session created: ${session.id}\n`);

  // 2) Open the WebSocket.
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?sessionId=${session.id}&userId=smoke-user`);
  const sendMsg = (m: ClientMessage) => ws.send(JSON.stringify(m));

  await new Promise<void>((resolve) => ws.on('open', () => resolve()));

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    switch (msg.type) {
      case WsMessageType.TranscriptFinal:
        console.log(`  [${msg.segment.lang}] ${msg.segment.text}` +
          (msg.segment.isFiltered ? '   (filtered)' : ''));
        break;
      case WsMessageType.Translation:
        console.log(`        ↳ ${msg.translation}`);
        break;
      case WsMessageType.SpecComplete:
        console.log('\n===== GENERATED SPEC =====\n');
        console.log(msg.spec.markdown);
        console.log('\n==========================\n');
        ws.close();
        void app.close().then(() => process.exit(0));
        break;
      case WsMessageType.Error:
        console.error('  ⚠ error:', msg.message);
        break;
      default:
        break;
    }
  });

  // 3) Start + stream 8 fake chunks + stop.
  sendMsg({ type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 });
  for (let seq = 0; seq < 8; seq++) {
    const fakeAudio = Buffer.from(`fake-audio-${seq}`).toString('base64');
    sendMsg({ type: WsMessageType.AudioChunk, sessionId: session.id, seq, data: fakeAudio });
    await new Promise((r) => setTimeout(r, 50));
  }
  sendMsg({ type: WsMessageType.StopSession, sessionId: session.id, generateSpec: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
