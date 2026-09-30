import http from "node:http";
import WebSocket from "ws";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const INMOTION_APP_URL = process.env.INMOTION_APP_URL;
const INTERNAL_WORKER_SECRET = process.env.INTERNAL_WORKER_SECRET;
const VOICE_WORKER_SECRET = process.env.VOICE_WORKER_SECRET;

if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
if (!INMOTION_APP_URL) throw new Error("INMOTION_APP_URL is required");
if (!INTERNAL_WORKER_SECRET) throw new Error("INTERNAL_WORKER_SECRET is required");
if (!VOICE_WORKER_SECRET) throw new Error("VOICE_WORKER_SECRET is required");

const sessions = new Map();

function json(res,status,body){
  res.writeHead(status,{"Content-Type":"application/json"});
  res.end(JSON.stringify(body));
}

async function readJson(req){
  const chunks=[];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function postInternal(path,body){
  return fetch(`${INMOTION_APP_URL.replace(/\/$/,"")}${path}`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-inmotion-worker-secret":INTERNAL_WORKER_SECRET
    },
    body:JSON.stringify(body)
  });
}

async function executeTool(sessionId,name,args){
  const response=await postInternal("/api/internal/voice/tool",{
    sessionId,
    name,
    arguments:args
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok) {
    return { ok:false,error:data.error || `Tool bridge failed with ${response.status}` };
  }
  return data;
}

async function reportSession(sessionId,event,extra={}){
  try{
    await postInternal("/api/internal/voice/session",{
      sessionId,
      event,
      ...extra
    });
  }catch(error){
    console.error("[voice-worker] lifecycle report failed",sessionId,error);
  }
}

async function transferSession(sessionId,targetUri){
  const response=await fetch(
    `https://api.openai.com/v1/live/sessions/${encodeURIComponent(sessionId)}/refer`,
    {
      method:"POST",
      headers:{
        Authorization:`Bearer ${OPENAI_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({target_uri:targetUri})
    }
  );

  if(!response.ok){
    throw new Error(`Transfer failed (${response.status}): ${await response.text()}`);
  }
}

function send(ws,payload){
  if(ws.readyState===WebSocket.OPEN){
    ws.send(JSON.stringify(payload));
  }
}

function attachSession(sessionId){
  if(sessions.has(sessionId)) return sessions.get(sessionId);

  const pendingCalls=new Map();
  const executed=new Set();

  const ws=new WebSocket(
    `wss://api.openai.com/v1/live/sessions/${encodeURIComponent(sessionId)}/attach`,
    {
      headers:{
        Authorization:`Bearer ${OPENAI_API_KEY}`
      }
    }
  );

  const state={ws,closed:false};
  sessions.set(sessionId,state);

  ws.on("open",()=>{
    console.log("[voice-worker] attached",sessionId);
  });

  ws.on("message",async raw=>{
    let envelope;
    try{
      envelope=JSON.parse(raw.toString());
    }catch{
      return;
    }

    if(envelope.type==="session.closed"){
      state.closed=true;
      await reportSession(sessionId,"closed",{metadata:{usage:envelope.usage ?? null}});
      sessions.delete(sessionId);
      return;
    }

    if(envelope.type==="error"){
      console.error("[voice-worker] OpenAI error",sessionId,envelope);
      await reportSession(sessionId,"worker_error",{error:envelope.error?.message || "OpenAI session error"});
      return;
    }

    if(envelope.type!=="response.event" || !envelope.event) return;

    const event=envelope.event;

    if(event.type==="response.output_item.added" && event.item?.type==="function_call"){
      pendingCalls.set(event.item.id || event.output_index,{
        callId:event.item.call_id || event.item.id,
        name:event.item.name,
        arguments:event.item.arguments || ""
      });
      return;
    }

    if(event.type==="response.function_call_arguments.delta"){
      const key=event.item_id || event.output_index;
      const current=pendingCalls.get(key);
      if(current){
        current.arguments += event.delta || "";
        pendingCalls.set(key,current);
      }
      return;
    }

    if(event.type!=="response.output_item.done" || event.item?.type!=="function_call") return;

    const item=event.item;
    const key=item.id || event.output_index;
    const pending=pendingCalls.get(key) || {};
    const callId=item.call_id || pending.callId || item.id;
    const name=item.name || pending.name;
    const rawArgs=item.arguments || pending.arguments || "{}";

    if(!callId || !name || executed.has(callId)) return;
    executed.add(callId);
    pendingCalls.delete(key);

    let args={};
    try{
      args=typeof rawArgs==="string" ? JSON.parse(rawArgs || "{}") : rawArgs;
    }catch{
      args={};
    }

    const toolResult=await executeTool(sessionId,name,args);
    const output=JSON.stringify(toolResult.ok===false ? {error:toolResult.error} : toolResult.result);

    send(ws,{
      type:"response.item.create",
      event_id:`tool_result_${callId}`,
      item:{
        type:"function_call_output",
        call_id:callId,
        output
      }
    });

    send(ws,{
      type:"response.create",
      event_id:`continue_${callId}`
    });

    if(
      name==="request_human_handover" &&
      toolResult?.result?.transferTarget
    ){
      setTimeout(async()=>{
        try{
          await transferSession(sessionId,toolResult.result.transferTarget);
        }catch(error){
          console.error("[voice-worker] transfer failed",sessionId,error);
          await reportSession(sessionId,"worker_error",{
            error:error instanceof Error ? error.message : String(error)
          });
        }
      },1800);
    }
  });

  ws.on("close",async(code,reason)=>{
    console.log("[voice-worker] socket closed",sessionId,code,reason.toString());
    sessions.delete(sessionId);

    if(!state.closed){
      await reportSession(sessionId,"worker_error",{
        error:`Sideband disconnected before session.closed (code ${code})`
      });
    }
  });

  ws.on("error",async error=>{
    console.error("[voice-worker] socket error",sessionId,error);
    await reportSession(sessionId,"worker_error",{
      error:error instanceof Error ? error.message : String(error)
    });
  });

  return state;
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET" && req.url==="/health"){
    return json(res,200,{ok:true,sessions:sessions.size});
  }

  if(req.method==="POST" && req.url==="/attach"){
    if(req.headers["x-inmotion-voice-worker-secret"]!==VOICE_WORKER_SECRET){
      return json(res,401,{error:"Unauthorized"});
    }

    try{
      const body=await readJson(req);
      const sessionId=String(body.sessionId || "");
      if(!sessionId) return json(res,400,{error:"sessionId is required"});

      attachSession(sessionId);
      return json(res,202,{ok:true,sessionId});
    }catch(error){
      return json(res,500,{
        error:error instanceof Error ? error.message : String(error)
      });
    }
  }

  return json(res,404,{error:"Not found"});
});

server.listen(PORT,()=>{
  console.log(`[voice-worker] listening on :${PORT}`);
});
