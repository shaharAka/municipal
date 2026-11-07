import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { EventEmitter } from 'node:events';
import { createTransportState, actorFor, snapshot, execute, weekday, TransportError, sourceData } from './engine.ts';
const changes = new EventEmitter(); changes.setMaxListeners(100);
const file = process.env.TRANSPORT_STATE_PATH || new URL('../../.local/transport-state.json',import.meta.url).pathname;
let state: any, loading: Promise<any>, queue: Promise<any> = Promise.resolve();
async function load() {
  if(state)return state;
  if(!loading)loading=(async()=>{
    try {const saved=JSON.parse(await readFile(file,'utf8'));if(saved.schema===1&&saved.sourceHash===sourceData.source.sha256)return state=saved;}catch{}
    state=createTransportState();state.sourceHash=sourceData.source.sha256;return state;
  })();
  return loading;
}
const json=(res:ServerResponse,status:number,body:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
async function body(req:IncomingMessage) {
  let text='';for await(const chunk of req){text+=chunk;if(text.length>200000)throw new TransportError('הבקשה גדולה מדי.',413);}
  try{return JSON.parse(text);}catch{throw new TransportError('הבקשה אינה JSON תקין.',400);}
}
async function commit(viewer:string,command:any) {
  const job=queue.then(async()=>{
    const current=await load();const next=structuredClone(current);
    const result=execute(next,viewer,command);
    if(!result.duplicate){
      await mkdir(dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(next));await rename(file+'.tmp',file);state=next;
      changes.emit('change',{date:command.date,revision:next.revision});
    }
    return {...result,state:snapshot(state,command.date,viewer)};
  });
  queue=job.catch(()=>{});return job;
}
export async function handleTransport(req:IncomingMessage,res:ServerResponse,url:URL) {
  try {
    const s=await load();
    const viewer=String(req.headers['x-transport-viewer']||url.searchParams.get('viewer')||'');
    actorFor(s,viewer);
    const date=url.searchParams.get('date')||'2026-11-08';weekday(date);
    if(url.pathname==='/api/transport/state'&&req.method==='GET')return json(res,200,snapshot(s,date,viewer));
    if(url.pathname==='/api/transport/events'&&req.method==='GET'){
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(`data: ${JSON.stringify({revision:s.revision})}\n\n`);
      const notify=(message:any)=>{if(message.date===date)res.write(`data: ${JSON.stringify(message)}\n\n`);};changes.on('change',notify);
      const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),20000);heartbeat.unref();
      req.on('close',()=>{clearInterval(heartbeat);changes.off('change',notify);});return;
    }
    if(url.pathname==='/api/transport/commands'&&req.method==='POST'){
      const origin=req.headers.origin;
      if(origin&&new URL(origin).host!==req.headers.host)throw new TransportError('יש להפעיל פעולות מתוך סביבת ההדגמה.',403);
      return json(res,200,await commit(viewer,await body(req)));
    }
    return json(res,404,{error:'הכתובת לא נמצאה.'});
  } catch(error){return json(res,error instanceof TransportError?error.status:500,{error:error instanceof TransportError?error.message:'לא ניתן לשמור את הפעולה. הנתונים לא עודכנו.'});}
}
