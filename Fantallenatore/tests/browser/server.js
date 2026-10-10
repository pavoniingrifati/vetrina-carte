'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
function instrumentShell(source,bridge){
 const end=source.lastIndexOf('})();');if(end<0)throw Error('Shell closure not found');
 return source.slice(0,end)+bridge+'\n'+source.slice(end);
}
function createServer(root){
 const bridge=fs.readFileSync(path.join(__dirname,'fixture-bridge.js'),'utf8');
 return http.createServer((req,res)=>{
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));}catch{res.writeHead(400);res.end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{
   if(error){res.writeHead(404);res.end();return;}
   if(file===path.join(root,'app_v302.js'))data=Buffer.from(instrumentShell(data.toString(),bridge));
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
   res.setHeader('Cache-Control','no-store');res.end(data);
  });
 });
}
module.exports={createServer,instrumentShell};
