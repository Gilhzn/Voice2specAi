# Voice2Spec AI

Record a bilingual (Hebrew / English) brainstorm, watch it transcribe and
translate **live**, automatically strip out small-talk and noise, and with one
tap generate a deep, machine-parseable engineering **specification (PRD)** in
Markdown — optimized for an AI developer (Claude Code) to turn straight into
production code.

This repository is a **pnpm-workspaces monorepo**:

```
voice2spec-root/
├── packages/
│   └── shared-types/     # WebSocket protocol + DTOs shared across tiers
└── apps/
    ├── server/           # Fastify backend — fully functional, tested
    └── mobile/           # React Native app — scaffolded, typechecked
```

## Architecture

| Tier        | Stack                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Mobile      | React Native (TS), React Navigation, Reanimated, Zustand              |
| Backend     | Node.js, Fastify, `@fastify/websocket`                                |
| Datastores  | PostgreSQL (encrypted at rest), Redis (live session state)            |
| AI          | OpenAI Whisper (STT) · Anthropic Claude (spec generation)             |

The live pipeline per audio chunk:

```
audio chunk → Whisper STT → language / code-switch detection
            → PII masking  → context filter → simultaneous translation
            → TranscriptSegment (streamed to the client over WebSocket)
```

On **Stop & Generate** the filtered transcript is wrapped in the *Blueprint
Engine* system prompt and sent to Claude, which returns the 8-section
specification (see `apps/server/src/services/claudeService.ts`).

### Offline-first: mocks & fallbacks

Every external dependency degrades gracefully so the whole system runs with
**no API keys and no datastores**:

| Dependency | When unconfigured                          |
| ---------- | ------------------------------------------ |
| OpenAI     | deterministic mock STT (canned bilingual)  |
| Anthropic  | deterministic mock spec generator          |
| Redis      | in-memory session store                    |
| PostgreSQL | in-memory repository                        |

Capability is reported live at `GET /health`.

## Security

- **In transit:** TLS 1.3 (terminate at your edge / load balancer).
- **At rest:** AES-256-GCM, with a **per-user key derived via HKDF** from
  `MASTER_ENCRYPTION_KEY`. Transcript segments and spec bodies are encrypted
  before they touch Postgres (`encryptionService.ts`).
- **PII masking:** regex middleware scrubs API keys, tokens, private keys,
  emails, cards and phone numbers to sanitized tags before storage / logging
  (`piiService.ts`, applied in the pipeline and as a REST `preHandler` hook).
- **Zero-Retention mode:** when enabled, raw transcripts are purged the moment
  the spec is generated.

## Getting started

```bash
pnpm install
pnpm --filter @voice2spec/shared-types build

# Backend (mock/in-memory — no config needed)
pnpm --filter server dev          # http://localhost:4000  ·  GET /health

# Full live pipeline smoke test (REST + WebSocket + spec)
pnpm --filter server ws:smoke
```

Optional real datastores:

```bash
cp .env.example .env              # then edit as needed
docker compose up -d              # postgres + redis
```

## Testing

```bash
pnpm -r typecheck
pnpm -r lint
pnpm --filter server test:cov     # unit + integration, ≥90% on core modules
pnpm --filter mobile test         # component / store / theme units
```

Coverage focuses on the correctness-critical modules: language detection,
PII masking, encryption and the context filter.

## Download the Android APK

A standalone, **signed release APK** is built by GitHub Actions
(`.github/workflows/android-apk.yml`) on the GitHub-hosted runners (which carry
the Android SDK/NDK) and published as a downloadable Release asset:

- **Releases → “Voice2Spec AI — Android APK”** → `Voice2Spec-AI-release.apk`
  (tag `android-latest`).
- Also available as a workflow **artifact** on each run.

Install on an Android device with “install from unknown sources” enabled. The
APK bundles the JS, so it runs standalone without a Metro dev server. It is
signed with the repository's **demo keystore** (`apps/mobile/android/app/
voice2spec-release.keystore`) — fine for testing/distribution, but replace it
with your own private keystore for a real Play Store release.

> Note: the APK can only be compiled on a host with access to Google's Maven
> repositories (`dl.google.com` / `maven.google.com`) — hence the CI build.

## Mobile app — native project

The native **`android/`** project is included and configured for this pnpm
monorepo (gradle paths point at the root `node_modules`, package
`com.voice2spec.app`, `RECORD_AUDIO` permission, release signing). Build it
locally with the Android toolchain installed:

```bash
pnpm install
pnpm --filter @voice2spec/shared-types build
cd apps/mobile/android && ./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release.apk
```

The `ios/` project is not generated (requires macOS/Xcode); run
`npx @react-native-community/cli init` style prebuild on a Mac to add it. The
native audio module behind `src/services/audioCapture.ts` is currently a stub —
wire a real recorder (AVAudioEngine / AudioRecord) for live microphone capture.

End-to-end tests are authored with **Detox** (`apps/mobile/e2e/`,
`.detoxrc.js`) and run once a native build + simulator are available.

## Real-time AI: live mic → streaming STT → Claude

When a **Server URL** is set in the app's Settings, recordings run through the
real backend:

1. The app captures **real microphone PCM** (`@fugood/react-native-audio-pcm-stream`)
   and streams it over a **WebSocket** to the server.
2. The server proxies the audio to **Deepgram's streaming API** for true
   word-by-word transcription (the Deepgram key never leaves the server),
   surfacing interim + final transcripts live.
3. Each final utterance is PII-masked, language-detected, **translated**
   (OpenAI), and noise-filtered.
4. On stop, **Anthropic Claude** generates the 8-section spec.

Run the server with keys (any subset — missing ones fall back to mocks):

```bash
DEEPGRAM_API_KEY=...  ANTHROPIC_API_KEY=sk-ant-...  OPENAI_API_KEY=sk-...  pnpm --filter server dev
```

With **no server configured**, the app runs the fully self-contained on-device
demo — so the APK works with zero setup.

## Deploy the server (Render, one click)

The repo includes `render.yaml` + `apps/server/Dockerfile`. In Render: **New +
→ Blueprint**, connect this repo, and set `DEEPGRAM_API_KEY`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` in the dashboard. Render builds the image
and gives you a public HTTPS URL — paste it into the app's **Settings → Server
URL** and you have real-time AI end to end. (The service boots with in-memory
storage so it works immediately; add managed Postgres/Redis for persistence.)

Locally with Docker: `docker build -f apps/server/Dockerfile -t voice2spec .`
then `docker run -p 4000:4000 -e DEEPGRAM_API_KEY=... -e ANTHROPIC_API_KEY=... voice2spec`.

## UX design tokens

True Black `#000000` background · Electric Teal `#00F5D4` accent ·
Rubik (Hebrew) / Inter (English) · 60fps fluid motion with a soft typewriter
transcript reveal and an organic, amplitude-reactive waveform. See
`apps/mobile/src/theme/`.
