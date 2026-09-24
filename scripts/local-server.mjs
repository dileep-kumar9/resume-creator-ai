import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleParseResume, handleTailor, handleAgent } from '../api/_lib/handlers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 8787);

function sendJson(res,status,data){
  const body=JSON.stringify(data);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body)});
  res.end(body);
}

const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
function serveStatic(req,res){
  let requestPath=decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname);
  if(requestPath==='/') requestPath='/index.html';
  const filePath=path.join(distPath,requestPath);
  if(!filePath.startsWith(distPath)||!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()){
    const fallback=path.join(distPath,'index.html');
    if(fs.existsSync(fallback)){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      return fs.createReadStream(fallback).pipe(res);
    }
    return sendJson(res,404,{error:'Build not found. Run npm run build first.'});
  }
  res.writeHead(200,{'Content-Type':`${mime[path.extname(filePath)]||'application/octet-stream'}; charset=utf-8`});
  fs.createReadStream(filePath).pipe(res);
}

http.createServer(async(req,res)=>{
  try{
    const route=req.url?.split('?')[0];
    if(req.method==='POST'&&route==='/api/parse-resume') return handleParseResume(req,res);
    if(req.method==='POST'&&route==='/api/tailor') return handleTailor(req,res);
    if(req.method==='POST'&&route==='/api/agent') return handleAgent(req,res);
    if(req.method==='GET'||req.method==='HEAD') return serveStatic(req,res);
    sendJson(res,405,{error:'Method not allowed.'});
  }catch(e){ sendJson(res,500,{error:e.message||'Server error.'}); }
}).listen(port,()=>console.log(`Resume Creator local server: http://localhost:${port}`));
