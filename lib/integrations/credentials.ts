import crypto from "crypto";

function getKey() {
  const secret = process.env.INTEGRATION_CREDENTIALS_KEY;
  if (!secret) {
    throw new Error("INTEGRATION_CREDENTIALS_KEY is not configured");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptCredential(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptCredential(input: {
  ciphertext: string;
  iv: string;
  tag: string;
}) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(input.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
