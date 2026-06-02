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

## Mobile app — finishing native setup

The mobile **JavaScript/TypeScript is complete and typechecks**, but the native
`ios/` and `android/` projects are not generated here (they require the React
Native CLI and platform SDKs/simulators). To run on a device/simulator:

```bash
cd apps/mobile
npx @react-native-community/cli init Voice2Spec --directory . --skip-install
pnpm install
# wire the native audio module behind src/services/audioCapture.ts
pnpm ios   # or: pnpm android
```

End-to-end tests are authored with **Detox** (`apps/mobile/e2e/`,
`.detoxrc.js`) and run once a native build + simulator are available.

## UX design tokens

True Black `#000000` background · Electric Teal `#00F5D4` accent ·
Rubik (Hebrew) / Inter (English) · 60fps fluid motion with a soft typewriter
transcript reveal and an organic, amplitude-reactive waveform. See
`apps/mobile/src/theme/`.
