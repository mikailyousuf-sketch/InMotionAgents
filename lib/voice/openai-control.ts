const OPENAI_BASE_URL = "https://api.openai.com/v1/live/sessions";

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is missing");
  return key;
}

export async function transferLiveSession(sessionId: string, targetUri: string) {
  const response = await fetch(
    `${OPENAI_BASE_URL}/${encodeURIComponent(sessionId)}/refer`,
    {
      method:"POST",
      headers:{
        Authorization:`Bearer ${apiKey()}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({ target_uri:targetUri })
    }
  );

  if (!response.ok) {
    throw new Error(`Voice transfer failed (${response.status}): ${await response.text()}`);
  }
}

export async function hangupLiveSession(sessionId: string) {
  const response = await fetch(
    `${OPENAI_BASE_URL}/${encodeURIComponent(sessionId)}/hangup`,
    {
      method:"POST",
      headers:{ Authorization:`Bearer ${apiKey()}` }
    }
  );

  if (!response.ok) {
    throw new Error(`Voice hangup failed (${response.status}): ${await response.text()}`);
  }
}
