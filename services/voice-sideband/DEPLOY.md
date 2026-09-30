# Voice worker deployment

The voice sideband worker must run as an always-on Node process. Vercel should host the Next.js app; deploy this worker separately.

## Runtime

- Node 20+
- Start command: `npm run voice-worker`
- Health check: `GET /health`
- Default port: `8787`

## Required environment

```
OPENAI_API_KEY=
INMOTION_APP_URL=https://<your-app-domain>
INTERNAL_WORKER_SECRET=
VOICE_WORKER_SECRET=
PORT=8787
```

The values for `INTERNAL_WORKER_SECRET` and `VOICE_WORKER_SECRET` must match the corresponding values configured on the Next.js deployment.

## Container

Build from repository root:

```bash
docker build -f services/voice-sideband/Dockerfile -t inmotion-voice .
docker run --rm -p 8787:8787 --env-file .env inmotion-voice
```

After deployment, set the Next.js environment variable:

```
VOICE_WORKER_URL=https://<worker-host>
```

Verify:

```
GET https://<worker-host>/health
```

Expected response:

```json
{"ok":true,"sessions":0}
```
