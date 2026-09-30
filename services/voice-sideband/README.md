# InMotion Voice Sideband Worker

Always-on Node service for GPT-Live SIP sessions.

It does not carry phone audio. SIP remains the primary audio transport. This worker attaches to the already-running GPT-Live session over the server-side sideband WebSocket, executes private InMotion tools, returns function results, and reports session lifecycle events.

## Required environment

- `OPENAI_API_KEY`
- `INMOTION_APP_URL` — public URL of the Next.js app
- `INTERNAL_WORKER_SECRET` — must match the Next.js app
- `VOICE_WORKER_SECRET` — must match the Next.js app
- `PORT` — optional, defaults to 8787

## Start

From the repository root:

```bash
npm run voice-worker
```

Deploy this as an always-on Node service (for example Railway, Render, Fly.io, or a small VM). Do not deploy the sideband process as a short-lived serverless function.

Health check:

```
GET /health
```

The Next.js voice webhook calls:

```
POST /attach
x-inmotion-voice-worker-secret: <VOICE_WORKER_SECRET>
```
