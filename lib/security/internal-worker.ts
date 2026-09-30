import crypto from "crypto";

export function isInternalWorkerRequest(request: Request) {
  const configured = process.env.INTERNAL_WORKER_SECRET;
  const supplied = request.headers.get("x-inmotion-worker-secret");

  if (!configured || !supplied) return false;

  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);

  if (configuredBuffer.length !== suppliedBuffer.length) return false;
  return crypto.timingSafeEqual(configuredBuffer, suppliedBuffer);
}
