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

## Real microphone → Whisper STT → Claude

When a **Server URL** is configured in the app's Settings, the recorder captures
real microphone audio (`react-native-audio-recorder-player`) and, on stop,
uploads the file to the server's `POST /transcribe` endpoint. The server runs
**OpenAI Whisper** over the recording (per-utterance segments), masks PII,
detects language, **translates each segment** (OpenAI), filters noise, and
generates the spec with **Anthropic Claude**. Run the server with keys:

```bash
OPENAI_API_KEY=sk-...  ANTHROPIC_API_KEY=sk-ant-...  pnpm --filter server dev
```

Without keys the server transparently uses deterministic mocks; with no server
configured the app falls back to the fully on-device demo. (True word-by-word
live streaming isn't possible with Whisper, which is not a streaming model — the
model is record → transcribe, but the transcription is real.)

## UX design tokens

True Black `#000000` background · Electric Teal `#00F5D4` accent ·
Rubik (Hebrew) / Inter (English) · 60fps fluid motion with a soft typewriter
transcript reveal and an organic, amplitude-reactive waveform. See
`apps/mobile/src/theme/`.
