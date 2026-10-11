'use strict';
// Rasterize the original SVG icon without external services.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const dir=path.resolve(__dirname,'../assets/app'),svg=fs.readFileSync(path.join(dir,'icon.svg'),'utf8');
 const browser=await chromium.launch({headless:true,...(process.env.FANTA_CHROMIUM?{executablePath:process.env.FANTA_CHROMIUM}:{})});
 try{for(const [size,name] of [[192,'icon-192.png'],[512,'icon-512.png'],[512,'icon-maskable-512.png'],[180,'apple-touch-icon.png']]){
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent('<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>'+svg);
  await page.screenshot({path:path.join(dir,name)});await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
