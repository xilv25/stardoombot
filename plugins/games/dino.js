import { Buffer } from 'buffer';
import { generateMessageID } from 'ourin';

export default {
    command: ['dino', 'dinorun'],
    category: 'game',
    description: '> Main game Dino Runner Interaktif di WhatsApp (dengan suara, Pterodactyl, dan kontrol Duck).',
    
    run: async (m, { conn }) => {
        const htmlPayload = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style='margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer'>
<div style='width:100%;max-width:620px;margin:auto;padding:16px;box-sizing:border-box'>
<div style='background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)'>
<div style='padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center'>
<div><div style='font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45)'>DANS ARCADE</div><div style='font-size:21px;font-weight:bold;color:#fff'>Dino Runner</div></div>
<div style='text-align:right'><div id='score' style='font-size:18px;font-weight:bold;color:#fff;text-shadow:0 0 10px rgba(108,92,231,.85);transition:transform .15s'>00000</div><div id='best' style='font-size:10px;color:rgba(255,255,255,.4);margin-top:2px'>BEST 00000</div></div>
</div>
<div style='padding:18px'>
<canvas id='game' width='560' height='190' style='width:100%;height:auto;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:12px;display:block'></canvas>
<div id='status' style='text-align:center;margin-top:10px;font-size:12px;color:rgba(255,255,255,.55)'>Speed 5.0x</div>
<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px'>
<button id='btn-duck' style='padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.07);color:#fff;font-weight:bold;font-size:16px;touch-action:none'>▼ DUCK</button>
<button id='btn-jump' style='padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.07);color:#fff;font-weight:bold;font-size:16px;touch-action:none'>▲ JUMP</button>
</div>
</div>
</div>
</div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');
const bJ=document.getElementById('btn-jump'),bD=document.getElementById('btn-duck');
const GY=170;let d,o,clouds,particles,ambient,trail,score,best=0,speed,gameOver,last,shake,flash,runT,spawnTimer,milestone,squash;
const aCtx=new(window.AudioContext||window.webkitAudioContext)();

function sfx(t){
  if(aCtx.state==='suspended')aCtx.resume();
  let o=aCtx.createOscillator(),g=aCtx.createGain(),n=aCtx.currentTime;
  o.connect(g);g.connect(aCtx.destination);
  if(t==='j'){
    o.type='square';o.frequency.setValueAtTime(250,n);o.frequency.exponentialRampToValueAtTime(600,n+0.1);
    g.gain.setValueAtTime(0.05,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.1);
    o.start(n);o.stop(n+0.1);
  }else if(t==='c'){
    o.type='sawtooth';o.frequency.setValueAtTime(150,n);o.frequency.exponentialRampToValueAtTime(40,n+0.25);
    g.gain.setValueAtTime(0.1,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.25);
    o.start(n);o.stop(n+0.25);
  }else if(t==='m'){
    o.type='square';o.frequency.setValueAtTime(800,n);o.frequency.setValueAtTime(1200,n+0.1);
    g.gain.setValueAtTime(0.05,n);g.gain.linearRampToValueAtTime(0,n+0.2);
    o.start(n);o.stop(n+0.2);
  }
}

function loadBest(){let vals=[];try{let v=localStorage.getItem('dino_best');if(v)vals.push(parseInt(v,10))}catch(e){}return vals.length?Math.max(...vals.filter(v=>!isNaN(v))):0}
function saveBest(v){let val=String(Math.floor(v));try{localStorage.setItem('dino_best',val)}catch(e){}}

best=loadBest();
bestEl.textContent='BEST '+String(Math.floor(best)).padStart(5,'0');

function reset(){
  d={x:55,y:132,w:27,h:30,vy:0,jumping:false,ducking:false};
  o=[];
  clouds=[{x:120,y:32,w:44,s:.35},{x:300,y:52,w:60,s:.22},{x:460,y:26,w:36,s:.4},{x:560,y:70,w:50,s:.18}];
  particles=[];trail=[];
  if(!ambient){ambient=[];for(let i=0;i<18;i++)ambient.push({x:Math.random()*c.width,y:Math.random()*c.height,r:.5+Math.random()*1.5,vx:.1+Math.random()*.3,ph:Math.random()*10})}
  score=0;speed=5;gameOver=false;last=0;shake=0;flash=0;runT=0;milestone=0;squash=1;spawnTimer=70+Math.random()*30;
  bestEl.textContent='BEST '+String(Math.floor(best)).padStart(5,'0');statusEl.textContent='Speed 5.0x';
}

function burst(px,py,n,col,spd){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd,life:1,col,size:2+Math.random()*2})}

function duckDino(isDucking){
  if(gameOver)return;
  if(isDucking){
    if(d.jumping)d.vy+=12; 
    d.ducking=true;
    if(!d.jumping){d.h=16;d.y=146;d.w=46;}
  }else{
    d.ducking=false;
    if(!d.jumping){d.h=30;d.y=132;d.w=27;}
  }
}

function jumpDino(){
  if(gameOver){reset();return}
  if(d.ducking && !d.jumping) duckDino(false);
  if(!d.jumping){sfx('j');d.jumping=true;d.vy=-13;squash=.7;burst(d.x+13,d.y+30,10,'255,255,255',4)}
}

function cactus(){
  let h=24+Math.random()*24;
  o.push({type:'cactus',x:c.width+20,y:GY-h,w:16+Math.random()*6,h});
  if(Math.random()<.22){o.push({type:'cactus',x:c.width+20+34+Math.random()*10,y:GY-(20+Math.random()*18),w:16,h:20+Math.random()*18})}
}

function bird(){
  let by=[148,126,105][Math.floor(Math.random()*3)]; 
  o.push({type:'bird',x:c.width+20,y:by,w:26,h:16,t:0});
}

function hit(a,b){return a.x+4<b.x+b.w&&a.x+a.w-4>b.x&&a.y+4<b.y+b.h&&a.y+a.h>b.y}

function drawTrail(){trail.forEach((p,i)=>{x.fillStyle='rgba(108,92,231,'+(.25*(i/trail.length))+')';x.fillRect(p.x,p.y,d.ducking?46:27,d.ducking?16:30)})}

function drawDino(){
  x.save();
  let cx=d.x+(d.w/2),cy=d.y+d.h;
  x.translate(cx,cy);x.scale(1/squash,squash);x.translate(-cx,-cy);
  let legOff=d.jumping?0:Math.sin(runT*.5)*5;
  if(d.ducking){
    x.fillStyle='#eaeaea';x.fillRect(d.x,d.y,38,16);x.fillRect(d.x+32,d.y+4,18,12);
    x.fillStyle='#6c5ce7';x.fillRect(d.x+40,d.y+6,4,4);
    x.fillStyle='#eaeaea';x.fillRect(d.x+8,d.y+16,6,8+legOff);x.fillRect(d.x+24,d.y+16,6,8-legOff);
  }else{
    x.fillStyle='#eaeaea';x.fillRect(d.x,d.y,27,30);x.fillRect(d.x+22,d.y+5,13,18);
    x.fillStyle='#6c5ce7';x.fillRect(d.x+29,d.y+8,4,4);
    x.fillStyle='#eaeaea';x.fillRect(d.x+5,d.y+30,6,8+legOff);x.fillRect(d.x+20,d.y+30,6,8-legOff);
  }
  x.restore();
}

function drawObstacle(q){
  x.save();
  if(q.type==='bird'){
    q.t=(q.t||0)+0.15;let flap=Math.sin(q.t)>0;
    x.shadowColor='rgba(162,155,254,.4)';x.shadowBlur=8;x.fillStyle='#a29bfe';
    x.fillRect(q.x,q.y+4,20,8);x.fillRect(q.x-4,q.y+6,4,4);
    if(flap){x.fillRect(q.x+6,q.y-6,14,10)}else{x.fillRect(q.x+6,q.y+12,14,10)}
    x.fillStyle='#fff';x.fillRect(q.x+20,q.y+6,6,4);
  }else{
    x.shadowColor='rgba(255,90,90,.35)';x.shadowBlur=10;x.fillStyle='#e17a7a';
    x.fillRect(q.x,q.y,q.w,q.h);x.fillRect(q.x-7,q.y+10,7,6);x.fillRect(q.x-7,q.y+4,6,12);
    x.fillRect(q.x+q.w,q.y+18,7,6);x.fillRect(q.x+q.w+1,q.y+12,6,12);
  }
  x.restore();
}

function drawAmbient(){ambient.forEach(p=>{let a=.15+Math.sin(runT*.05+p.ph)*.1;x.fillStyle='rgba(180,160,255,'+a+')';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()})}

function draw(){
  x.clearRect(0,0,c.width,c.height);x.save();
  if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  drawAmbient();
  x.fillStyle='rgba(255,255,255,.35)';clouds.forEach(q=>{let b=Math.sin(runT*.03+q.x)*2;x.fillRect(q.x,q.y+b,q.w,5);x.fillRect(q.x+10,q.y+b-5,q.w*.45,10)});
  x.strokeStyle='rgba(255,255,255,.25)';x.lineWidth=2;x.setLineDash([10,8]);x.lineDashOffset=-runT*speed*.6;
  x.beginPath();x.moveTo(0,GY);x.lineTo(c.width,GY);x.stroke();x.setLineDash([]);
  drawTrail();drawDino();o.forEach(drawObstacle);
  particles.forEach(p=>{x.fillStyle='rgba('+p.col+','+Math.max(p.life,0)+')';x.fillRect(p.x,p.y,p.size,p.size)});
  if(flash>0){x.fillStyle='rgba(255,60,60,'+(flash*.35)+')';x.fillRect(0,0,c.width,c.height)}
  x.restore();
  if(gameOver){
    x.fillStyle='rgba(15,15,25,.55)';x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#fff';x.textAlign='center';x.font='bold 24px Arial';x.fillText('GAME OVER',c.width/2,85);
    x.font='14px Arial';x.fillText('Tap layar untuk main lagi',c.width/2,112);x.textAlign='left';
  }
}

function loop(t){
  if(!last)last=t;let dt=Math.min((t-last)/16.67,2);last=t;runT+=dt;
  if(!gameOver){
    d.y+=d.vy*dt;d.vy+=.75*dt;
    let targetY=d.ducking?146:132;
    if(d.y>=targetY){
      if(d.jumping){burst(d.x+13,GY,10,'255,255,255',3.5);squash=1.35;if(d.ducking){d.h=16;d.w=46}else{d.h=30;d.w=27}}
      d.y=targetY;d.vy=0;d.jumping=false;
    }
    if(d.jumping)trail.push({x:d.x,y:d.y});if(trail.length>6)trail.shift();if(!d.jumping)trail.length=0;
    squash+=(1-squash)*.18*dt;
    if(!d.jumping&&Math.floor(runT)%8===0&&Math.random()<.4)burst(d.x+(d.w/2),GY-2,1,'255,255,255',1.5);
    ambient.forEach(p=>{p.x-=p.vx*dt;if(p.x<-4)p.x=c.width+4});
    spawnTimer-=dt;
    if(spawnTimer<=0){
      if(score>150&&Math.random()<.35)bird();else cactus();
      spawnTimer=Math.max(38,62-speed*1.4)+Math.random()*30;
    }
    o.forEach(q=>q.x-=speed*dt*(q.type==='bird'?1.2:1));o=o.filter(q=>q.x>-40);
    clouds.forEach(q=>{q.x-=q.s*dt;if(q.x<-80)q.x=c.width+Math.random()*100});
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.3*dt;p.life-=.03*dt});particles=particles.filter(p=>p.life>0);
    speed=Math.min(11,speed+.0018*dt);score+=dt*.6;if(score>best)best=score;
    if(Math.floor(score/500)>milestone){milestone=Math.floor(score/500);sfx('m');scoreEl.style.transform='scale(1.35)';setTimeout(()=>scoreEl.style.transform='scale(1)',150)}
    scoreEl.textContent=String(Math.floor(score)).padStart(5,'0');bestEl.textContent='BEST '+String(Math.floor(best)).padStart(5,'0');statusEl.textContent='Speed '+speed.toFixed(1)+'x';
    for(const q of o)if(hit(d,q)){if(!gameOver)sfx('c');gameOver=true;shake=14;flash=1;saveBest(best);burst(d.x+(d.w/2),d.y+15,18,'255,90,90',5)}
  }
  if(shake>0)shake=Math.max(0,shake-.6*dt);if(flash>0)flash=Math.max(0,flash-.05*dt);
  draw();requestAnimationFrame(loop);
}

bJ.addEventListener('pointerdown',e=>{e.preventDefault();jumpDino()});
bD.addEventListener('pointerdown',e=>{e.preventDefault();duckDino(true)});
bD.addEventListener('pointerup',e=>{e.preventDefault();duckDino(false)});
bD.addEventListener('pointerleave',e=>{e.preventDefault();duckDino(false)});
c.addEventListener('pointerdown',e=>{if(aCtx.state==='suspended')aCtx.resume();e.preventDefault();jumpDino()});

document.addEventListener('keydown',e=>{
  if(aCtx.state==='suspended')aCtx.resume();
  if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();jumpDino()}
  if(e.code==='ArrowDown'){e.preventDefault();duckDino(true)}
});
document.addEventListener('keyup',e=>{if(e.code==='ArrowDown'){e.preventDefault();duckDino(false)}});

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
                        trusted_sources: ["adam.dev"]
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
                    }] }
                }
            },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [{ messageType: 2, messageText: "Dino Runner" }],
                        unifiedResponse: { data: Buffer.from(JSON.stringify(unifiedJson)).toString('base64') },
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
        }
    }
};