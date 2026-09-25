import { Buffer } from 'buffer';
import { generateMessageID } from 'ourin';

export default {
  command: ['snake', 'ular'],
  category: 'game',
  description: '> Memainkan Snake Game (StarDoom Games) interaktif dengan efek suara 8-bit.',
  
  run: async (m, { conn }) => {
    if (m.react) await m.react('🐍');

    const htmlPayload = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;padding:16px;box-sizing:border-box">
<div style="background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45)">STARDOOM GAMES</div><div style="font-size:21px;font-weight:bold;color:#fff">Snake Game</div></div>
<div style="text-align:right"><div id="score" style="font-size:18px;font-weight:bold;color:#fff;text-shadow:0 0 10px rgba(108,92,231,.85);transition:transform .15s">00000</div><div id="best" style="font-size:10px;color:rgba(255,255,255,.4);margin-top:2px">BEST 00000</div></div>
</div>
<div style="padding:18px">
<canvas id="game" width="560" height="420" style="width:100%;height:auto;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:12px;display:block"></canvas>
<div id="status" style="text-align:center;margin-top:10px;font-size:12px;color:rgba(255,255,255,.55)">Length 3 • Speed 1.0x</div>
<div style="width:180px;margin:16px auto 0;display:grid;grid-template-columns:55px 55px 55px;grid-template-rows:55px 55px;gap:7px">
<button id="up" style="grid-column:2;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;font-size:22px">▲</button>
<button id="left" style="grid-column:1;grid-row:2;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;font-size:22px">◀</button>
<button id="down" style="grid-column:2;grid-row:2;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;font-size:22px">▼</button>
<button id="right" style="grid-column:3;grid-row:2;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;font-size:22px">▶</button>
</div>
</div>
</div>
</div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');
const up=document.getElementById('up'),down=document.getElementById('down'),left=document.getElementById('left'),right=document.getElementById('right');
const cols=28,rows=21,cell=20;
let snake,food,dir,nextDir,score,best,gameOver,last,accumulator,speed,particles,started;

const aCtx=new(window.AudioContext||window.webkitAudioContext)();
function sfx(t){
  if(aCtx.state==='suspended')aCtx.resume();
  let o=aCtx.createOscillator(),g=aCtx.createGain(),n=aCtx.currentTime;
  o.connect(g);g.connect(aCtx.destination);
  if(t==='m'){
    o.type='sine';o.frequency.setValueAtTime(300,n);o.frequency.exponentialRampToValueAtTime(100,n+0.05);
    g.gain.setValueAtTime(0.05,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.05);
    o.start(n);o.stop(n+0.05);
  }else if(t==='e'){
    o.type='square';o.frequency.setValueAtTime(400,n);o.frequency.setValueAtTime(600,n+0.05);
    g.gain.setValueAtTime(0.05,n);g.gain.linearRampToValueAtTime(0,n+0.1);
    o.start(n);o.stop(n+0.1);
  }else if(t==='d'){
    o.type='sawtooth';o.frequency.setValueAtTime(150,n);o.frequency.exponentialRampToValueAtTime(40,n+0.3);
    g.gain.setValueAtTime(0.1,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.3);
    o.start(n);o.stop(n+0.3);
  }
}

try{best=parseInt(localStorage.getItem('snake_best')||'0',10)||0}catch(e){best=0}

function reset(){
snake=[{x:13,y:10},{x:12,y:10},{x:11,y:10}];
dir={x:1,y:0};
nextDir={x:1,y:0};
score=0;
speed=1;
gameOver=false;
started=false;
last=0;
accumulator=0;
particles=[];
spawnFood();
bestEl.textContent='BEST '+String(best).padStart(5,'0');
scoreEl.textContent='00000';
statusEl.textContent='Length 3 • Speed 1.0x';
draw();
}

function spawnFood(){
let ok=false;
while(!ok){
food={x:Math.floor(Math.random()*cols),y:Math.floor(Math.random()*rows)};
ok=!snake.some(s=>s.x===food.x&&s.y===food.y);
}
}

function setDir(xd,yd){
if(xd===-dir.x&&yd===-dir.y)return;
if(xd===-nextDir.x&&yd===-nextDir.y)return;
if(started)sfx('m');
nextDir={x:xd,y:yd};
started=true;
}

function eatEffect(px,py){
for(let i=0;i<18;i++){
let a=Math.random()*Math.PI*2;
let s=Math.random()*3+1;
particles.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1});
}
}

function endGame(){
if(!gameOver)sfx('d');
gameOver=true;
if(score>best){
best=score;
try{localStorage.setItem('snake_best',String(best))}catch(e){}
}
}

function move(){
dir=nextDir;
let head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};

if(head.x<0||head.x>=cols||head.y<0||head.y>=rows){
endGame();
return;
}

if(snake.some((s,i)=>i>0&&s.x===head.x&&s.y===head.y)){
endGame();
return;
}

snake.unshift(head);

if(head.x===food.x&&head.y===food.y){
score+=10;
speed=Math.min(2.8,1+score/500);
sfx('e');
eatEffect(food.x*cell+10,food.y*cell+10);
spawnFood();
}else{
snake.pop();
}

if(score>best)best=score;
scoreEl.textContent=String(score).padStart(5,'0');
bestEl.textContent='BEST '+String(best).padStart(5,'0');
statusEl.textContent='Length '+snake.length+' • Speed '+speed.toFixed(1)+'x';

if(score%50===0&&score>0){
scoreEl.style.transform='scale(1.3)';
setTimeout(()=>scoreEl.style.transform='scale(1)',120);
}
}

function roundRect(px,py,w,h,r){
x.beginPath();x.moveTo(px+r,py);x.lineTo(px+w-r,py);x.quadraticCurveTo(px+w,py,px+w,py+r);x.lineTo(px+w,py+h-r);x.quadraticCurveTo(px+w,py+h,px+w-r,py+h);x.lineTo(px+r,py+h);x.quadraticCurveTo(px,py+h,px,py+h-r);x.lineTo(px,py+r);x.quadraticCurveTo(px,py,px+r,py);x.closePath();
}

function draw(){
x.clearRect(0,0,c.width,c.height);
let bg=x.createRadialGradient(280,210,10,280,210,400);
bg.addColorStop(0,'rgba(108,92,231,.10)');
bg.addColorStop(1,'rgba(255,255,255,.015)');
x.fillStyle=bg;
x.fillRect(0,0,c.width,c.height);

x.strokeStyle='rgba(255,255,255,.035)';
x.lineWidth=1;
for(let i=1;i<cols;i++){x.beginPath();x.moveTo(i*cell,0);x.lineTo(i*cell,c.height);x.stroke();}
for(let i=1;i<rows;i++){x.beginPath();x.moveTo(0,i*cell);x.lineTo(c.width,i*cell);x.stroke();}

let fx=food.x*cell+10;
let fy=food.y*cell+10;
x.save();x.shadowColor='rgba(255,80,100,.8)';x.shadowBlur=18;x.fillStyle='#ff6475';x.beginPath();x.arc(fx,fy,7,0,Math.PI*2);x.fill();x.shadowBlur=0;x.fillStyle='rgba(255,255,255,.7)';x.beginPath();x.arc(fx-2,fy-2,2,0,Math.PI*2);x.fill();x.restore();

snake.forEach((s,i)=>{
let px=s.x*cell+3;let py=s.y*cell+3;let size=cell-6;
x.save();x.shadowColor='rgba(108,92,231,.55)';x.shadowBlur=i===0?14:7;x.fillStyle=i===0?'#9487ff':'#6c5ce7';
roundRect(px,py,size,size,i===0?7:5);x.fill();x.shadowBlur=0;

if(i===0){
x.fillStyle='#fff';
let ex1,ey1,ex2,ey2;
if(dir.x===1){ex1=px+12;ey1=py+6;ex2=px+12;ey2=py+12;}
else if(dir.x===-1){ex1=px+6;ey1=py+6;ex2=px+6;ey2=py+12;}
else if(dir.y===-1){ex1=px+6;ey1=py+6;ex2=px+12;ey2=py+6;}
else{ex1=px+6;ey1=py+12;ex2=px+12;ey2=py+12;}
x.beginPath();x.arc(ex1,ey1,1.8,0,Math.PI*2);x.arc(ex2,ey2,1.8,0,Math.PI*2);x.fill();
}
x.restore();
});

particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=.96;p.vy*=.96;p.life-=.025;x.fillStyle='rgba(150,135,255,'+Math.max(0,p.life)+')';x.fillRect(p.x,p.y,3,3);});
particles=particles.filter(p=>p.life>0);

if(gameOver){
x.fillStyle='rgba(10,10,18,.68)';x.fillRect(0,0,c.width,c.height);
x.fillStyle='#fff';x.textAlign='center';
x.font='bold 25px Arial';x.fillText('GAME OVER',c.width/2,190);
x.font='14px Arial';x.fillStyle='rgba(255,255,255,.65)';x.fillText('Tap layar untuk bermain lagi',c.width/2,220);
x.font='bold 14px Arial';x.fillStyle='#fff';x.fillText('SCORE '+String(score).padStart(5,'0'),c.width/2,247);
x.textAlign='left';
}
}

function loop(t){
if(!last)last=t;
let dt=Math.min((t-last)/16.67,2);
last=t;
if(!gameOver&&started){
accumulator+=dt;
let interval=8/speed;
if(accumulator>=interval){accumulator=0;move();}
}
draw();
requestAnimationFrame(loop);
}

up.addEventListener('pointerdown',e=>{e.preventDefault();setDir(0,-1)});
down.addEventListener('pointerdown',e=>{e.preventDefault();setDir(0,1)});
left.addEventListener('pointerdown',e=>{e.preventDefault();setDir(-1,0)});
right.addEventListener('pointerdown',e=>{e.preventDefault();setDir(1,0)});

document.addEventListener('keydown',e=>{
if(e.key==='ArrowUp'||e.key==='w'||e.key==='W'){e.preventDefault();setDir(0,-1);}
if(e.key==='ArrowDown'||e.key==='s'||e.key==='S'){e.preventDefault();setDir(0,1);}
if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){e.preventDefault();setDir(-1,0);}
if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){e.preventDefault();setDir(1,0);}
});

c.addEventListener('pointerdown',e=>{if(aCtx.state==='suspended')aCtx.resume();if(gameOver){reset();return;}if(!started)started=true;});
reset();requestAnimationFrame(loop);
</script></body>`;

    const minifiedHtml = htmlPayload.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();
    
    const unifiedJson = {
      response_id: "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
      sections: [{
        view_model: {
          primitive: {
            __typename: "GenAIaeacdsnwHtmlPrimitive",
            payload: minifiedHtml,
            trusted_sources: ["stardoom.dev", "youtube.com", "google.com"]
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      }]
    };

    const rawPayload = {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: "",
          botResponseId: "b2e40280-433c-45d8-9c1a-270bec558860",
          verificationMetadata: { proofs: [{
            version: 1, useCase: 1,
            signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
            certificateChain: [
              "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
              "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
            ]
          }]
        }
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: "Snake Game" }],
          unifiedResponse: { data: Buffer.from(JSON.stringify(unifiedJson)) },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
            forwardOrigin: 4
          }
        }
      }
    }
  };

  try {
    const msgId = generateMessageID();
    await conn.relayMessage(m.chat, rawPayload, { messageId: msgId, additionalAttributes: {} });
  } catch (err) {
    console.error(err);
    m.reply("Gagal merender game. Cek log server.");
  }
}
};