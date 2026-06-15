const http=require("node:http"),WebSocket=require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
http.get("http://localhost:9222/json/list",res=>{let d="";res.on("data",c=>d+=c);res.on("end",async()=>{
const page=JSON.parse(d).find(t=>t.type==="page"&&/5180/.test(t.url));const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0;const p={};const cmd=(m,pa)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pa}))});
const ev=async e=>(await cmd("Runtime.evaluate",{expression:e,returnByValue:true})).result?.result?.value;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));ws.on("message",m=>{const o=JSON.parse(m);if(o.id&&p[o.id]){p[o.id](o);delete p[o.id]}});
ws.on("open",async()=>{const SC="window.ddGame.scene.scenes[0]";await cmd("Page.enable",{});
await ev("location.reload()");
for(let i=0;i<16;i++){await sleep(700);if(await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0)`))break;}
if((await ev(`${SC}.room.state.mode`))!=="arena")await ev(`${SC}.room.send('toggleTraining')`);
await sleep(9000);
console.log("collision:",await ev(`(()=>{const r=${SC}.room,es=[];r.state.enemies.forEach(e=>es.push(e));let stacked=0;for(let i=0;i<es.length;i++)for(let j=i+1;j<es.length;j++)if(Math.hypot(es[i].x-es[j].x,es[i].y-es[j].y)<22)stacked++;return JSON.stringify({enemies:es.length,stackedPairs_under22px:stacked});})()`));
const nearest=`(()=>{const r=${SC}.room,s=r.state.players.get(r.sessionId);let n=1e9;r.state.enemies.forEach(e=>{const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<n)n=d;});return Math.round(n);})()`;
const before=await ev(nearest);await ev(`${SC}.room.send('parry')`);await sleep(300);const after=await ev(nearest);
console.log("parry knockback: nearest enemy",before,"->",after,after>before?"(pushed away ✓)":"(no change)");
ws.close();process.exit(0)})})}).on("error",e=>{console.log("err",e.message);process.exit(1)});
