import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

function initDB() {
    const DB_PATH = path.resolve(process.cwd(), 'database', 'skor.json');
    if (!fs.existsSync(path.dirname(DB_PATH))) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ tetris: {} }));
    }
    return DB_PATH;
}

function getLeaderboard() {
    try {
        const DB_PATH = initDB();
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        const tetrisData = data.tetris || {};
        
        return Object.entries(tetrisData)
            .map(([jid, info]) => ({ jid, name: info.name, score: info.score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    } catch (e) {
        return [];
    }
}

function createTetrisHTML(leaderboardData, sender, pushName) {
    const jsonLeaderboard = JSON.stringify(leaderboardData);
    const topScore = leaderboardData.length > 0 ? leaderboardData[0].score : 0;
    const safeName = pushName.replace(/'/g, "\\'");
    
    return `
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-tap-highlight-color: transparent; font-family: 'Nunito', sans-serif; }
body { display: flex; justify-content: center; background: transparent; color: #fff; height: 100vh; overflow: hidden; align-items: center; }
.game-frame { width: 100%; height: 100%; max-height: 720px; max-width: 420px; background: #1c1c1e; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
.top-bar { display: flex; justify-content: space-between; align-items: center; background: #111112; padding: 12px 20px; border-bottom: 2px solid #2c2c2e; }
.stat-box { display: flex; flex-direction: column; align-items: center; }
.stat-lbl { font-size: 10px; color: #8e8e93; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
.stat-val { font-size: 18px; color: #ff9f0a; font-weight: 900; }
.stat-val.score { color: #32ade6; }
.canvas-container { position: relative; flex: 1; display: flex; justify-content: center; align-items: center; background: #000; padding: 15px 0; }
canvas { background: #111112; border-radius: 10px; border: 2px solid #2c2c2e; box-shadow: 0 0 20px rgba(0,0,0,0.8); image-rendering: pixelated; width: 220px; height: 440px; }
.overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 10; padding: 20px; text-align: center; }
.o-title { font-size: 24px; font-weight: 900; color: #ff375f; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px; }
.o-score { font-size: 48px; font-weight: 900; color: #30d158; margin-bottom: 5px; }
.o-status { font-size: 12px; color: #8e8e93; margin-bottom: 25px; height: 20px; }
.btn-primary { background: #ff375f; color: #fff; border: none; padding: 16px 30px; border-radius: 14px; font-size: 16px; font-weight: 900; letter-spacing: 1px; box-shadow: 0 6px 0 #bd1335; transition: 0.1s; width: 100%; max-width: 200px; cursor: pointer; }
.btn-primary:active { transform: translateY(6px); box-shadow: 0 0 0 #bd1335; }
.lb-list { width: 100%; max-width: 250px; max-height: 250px; overflow-y: auto; text-align: left; margin-bottom: 20px; }
.lb-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2c2c2e; font-size: 14px; }
.lb-item:first-child { color: #ffd60a; font-size: 16px; }
.lb-item:nth-child(2) { color: #e5e5ea; }
.lb-item:nth-child(3) { color: #b87333; }
.lb-item span:last-child { font-weight: 900; }
.control-panel { background: #1c1c1e; padding: 20px; border-top: 1px solid #2c2c2e; padding-bottom: 30px; }
.tools-row { display: flex; justify-content: center; gap: 15px; margin-bottom: 15px; }
.btn-tool { background: transparent; border: 2px solid #3a3a3c; color: #8e8e93; border-radius: 10px; width: 45px; height: 45px; display: flex; justify-content: center; align-items: center; font-size: 18px; transition: 0.1s; cursor: pointer; }
.btn-tool:active { background: #3a3a3c; color: #fff; transform: scale(0.9); }
.grid-controls { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.btn-pad { background: #2c2c2e; border: none; border-radius: 14px; height: 60px; color: #fff; font-size: 24px; display: flex; justify-content: center; align-items: center; transition: 0.1s; box-shadow: inset 0 -3px 0 rgba(0,0,0,0.2); cursor: pointer; }
.btn-pad:active { background: #3a3a3c; transform: scale(0.95); box-shadow: none; }
.btn-action { grid-column: span 2; background: #ff375f; box-shadow: 0 6px 0 #bd1335; font-size: 16px; font-weight: 900; letter-spacing: 1px; color: #fff; }
.btn-action:active { box-shadow: 0 0 0 #bd1335; transform: translateY(6px); }
.footer-tips { text-align: center; font-size: 9px; color: #636366; margin-top: 15px; font-weight: 700; letter-spacing: 0.5px; }
.footer-tips span { color: #ff375f; }
</style>
<div class="game-frame">
    <div class="top-bar">
        <div class="stat-box">
            <div class="stat-lbl">SCORE</div>
            <div class="stat-val score" id="uiScore">0</div>
        </div>
        <div class="stat-box">
            <div class="stat-lbl">HI-SCORE</div>
            <div class="stat-val">${topScore}</div>
        </div>
    </div>
    <div class="canvas-container">
        <canvas id="tetris" width="200" height="400"></canvas>
        <div class="overlay" id="gameOver">
            <div class="o-title">GAME OVER</div>
            <div class="o-score" id="finalScore">0</div>
            <div class="o-status" id="saveStatus">Menyimpan skor...</div>
            <button class="btn-primary" id="btnRestart">MAIN LAGI</button>
        </div>
        <div class="overlay" id="lbView">
            <div class="o-title" style="color: #ffd60a; font-size: 20px;">LEADERBOARD</div>
            <div class="lb-list" id="lbList"></div>
            <button class="btn-primary" id="btnCloseLB" style="background: #32ade6; box-shadow: 0 6px 0 #0077b6;">TUTUP</button>
        </div>
    </div>
    <div class="control-panel">
        <div class="tools-row">
            <div class="btn-tool" id="btnTrophy">🏆</div>
            <div class="btn-tool" id="btnPause">⏸</div>
        </div>
        <div class="grid-controls">
            <div class="btn-pad" id="btnLeft">◀</div>
            <div class="btn-pad" id="btnDown">▼</div>
            <div class="btn-pad" id="btnRight">▶</div>
            <div class="btn-pad btn-action" id="btnRotate">↻ ROTASI</div>
        </div>
        <div class="footer-tips">
            ● <span>TETRIS AIRICH</span> VERSI NATIVE ●
        </div>
    </div>
</div>
<script>
window.onerror=function(m,s,l,c,e){document.body.innerHTML='<div style="color:red;padding:20px;font-size:12px;background:#111;width:100%;">SYSTEM ERROR:<br>'+m+'<br>Line: '+l+'</div>'};
const canvas=document.getElementById('tetris');
const ctx=canvas.getContext('2d');
ctx.scale(20,20);
const colors=[null,'#ff375f','#5e5ce6','#32ade6','#ffd60a','#30d158','#ff9f0a','#bf5af2'];
const matrixData=[[],[[0,1,0],[1,1,1],[0,0,0]],[[2,0,0],[2,2,2],[0,0,0]],[[0,0,3],[3,3,3],[0,0,0]],[[4,4],[4,4]],[[0,5,5],[5,5,0],[0,0,0]],[[6,6,0],[0,6,6],[0,0,0]],[[0,0,0,0],[7,7,7,7],[0,0,0,0],[0,0,0,0]]];
function createMatrix(w,h){const m=[];for(let i=0;i<h;i++){m.push(new Array(w).fill(0))}return m}
let arena=createMatrix(10,20);
let player={pos:{x:0,y:0},matrix:null,score:0};
let dropCounter=0;
let dropInterval=1000;
let lastTime=0;
let isGameOver=false;
let isPaused=false;
let reqId;
const ui={score:document.getElementById('uiScore'),gameOver:document.getElementById('gameOver'),finalScore:document.getElementById('finalScore'),saveStatus:document.getElementById('saveStatus'),lbView:document.getElementById('lbView'),lbList:document.getElementById('lbList')};
const lbData=${jsonLeaderboard};
function drawMatrix(matrix,offset){matrix.forEach((row,y)=>{row.forEach((value,x)=>{if(value!==0){ctx.fillStyle=colors[value];ctx.fillRect(x+offset.x,y+offset.y,1,1);ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillRect(x+offset.x,y+offset.y,1,0.15);ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(x+offset.x,y+offset.y+0.85,1,0.15);ctx.lineWidth=0.05;ctx.strokeStyle='#111112';ctx.strokeRect(x+offset.x,y+offset.y,1,1)}})})}
function draw(){ctx.fillStyle='#111112';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#1c1c1e';ctx.lineWidth=0.05;for(let i=1;i<10;i++){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,20);ctx.stroke()}for(let j=1;j<20;j++){ctx.beginPath();ctx.moveTo(0,j);ctx.lineTo(10,j);ctx.stroke()}drawMatrix(arena,{x:0,y:0});if(player.matrix)drawMatrix(player.matrix,player.pos)}
function merge(arena,player){player.matrix.forEach((row,y)=>{row.forEach((value,x)=>{if(value!==0)arena[y+player.pos.y][x+player.pos.x]=value})})}
function collide(arena,player){const m=player.matrix,o=player.pos;for(let y=0;y<m.length;++y){for(let x=0;x<m[y].length;++x){if(m[y][x]!==0&&(arena[y+o.y]&&arena[y+o.y][x+o.x])!==0)return true}}return false}
function rotate(matrix,dir){for(let y=0;y<matrix.length;++y){for(let x=0;x<y;++x){let temp=matrix[x][y];matrix[x][y]=matrix[y][x];matrix[y][x]=temp}}if(dir>0)matrix.forEach(row=>row.reverse());else matrix.reverse()}
function playerRotate(){if(isPaused)return;const pos=player.pos.x;let offset=1;rotate(player.matrix,1);while(collide(arena,player)){player.pos.x+=offset;offset=-(offset+(offset>0?1:-1));if(offset>player.matrix[0].length){rotate(player.matrix,-1);player.pos.x=pos;return}}}
function playerDrop(){if(isPaused)return;player.pos.y++;if(collide(arena,player)){player.pos.y--;merge(arena,player);playerReset();arenaSweep()}dropCounter=0}
function playerMove(dir){if(isPaused)return;player.pos.x+=dir;if(collide(arena,player))player.pos.x-=dir}
async function submitScore(score){if(score===0){ui.saveStatus.innerText="SKOR 0 TIDAK DICATAT";return}try{const res=await fetch('http://45.134.39.55:2096/api/tetris/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jid:'${sender}',name:'${safeName}',score:score})});const data=await res.json();if(data.success){ui.saveStatus.innerText=data.newRecord?"REKOR BARU TERSIMPAN":"SKOR TERSIMPAN";ui.saveStatus.style.color=data.newRecord?"#ff375f":"#30d158"}else{ui.saveStatus.innerText="GAGAL MENYIMPAN"}}catch(err){ui.saveStatus.innerText="KONEKSI SERVER TERPUTUS"}}
function playerReset(){const pieces=[1,2,3,4,5,6,7];const type=pieces[Math.floor(Math.random()*pieces.length)];player.matrix=matrixData[type];player.pos.y=0;player.pos.x=(Math.floor(arena[0].length/2))-(Math.floor(player.matrix[0].length/2));if(collide(arena,player)){isGameOver=true;ui.gameOver.style.display='flex';ui.finalScore.innerText=player.score;submitScore(player.score)}}
function arenaSweep(){let rowCount=1;outer:for(let y=arena.length-1;y>=0;--y){for(let x=0;x<arena[y].length;++x){if(arena[y][x]===0)continue outer}const row=arena.splice(y,1)[0].fill(0);arena.unshift(row);++y;player.score+=rowCount*10;rowCount*=2;dropInterval=Math.max(150,dropInterval-10)}ui.score.innerText=player.score}
function update(time=0){if(isGameOver||isPaused)return;const deltaTime=time-lastTime;lastTime=time;dropCounter+=deltaTime;if(dropCounter>dropInterval)playerDrop();draw();reqId=requestAnimationFrame(update)}
function initLB(){ui.lbList.innerHTML='';if(lbData.length===0){ui.lbList.innerHTML='<div style="text-align:center;color:#8e8e93;margin-top:20px;">Belum ada rekor</div>'}else{lbData.forEach((u,i)=>{let display='<div class="lb-item">';display+='<span>'+(i+1)+'. '+u.name.substring(0,12)+'</span>';display+='<span>'+u.score+'</span></div>';ui.lbList.innerHTML+=display})}}
document.getElementById('btnLeft').addEventListener('pointerdown',()=>playerMove(-1));
document.getElementById('btnRight').addEventListener('pointerdown',()=>playerMove(1));
document.getElementById('btnDown').addEventListener('pointerdown',()=>playerDrop());
document.getElementById('btnRotate').addEventListener('pointerdown',()=>playerRotate());
document.getElementById('btnPause').addEventListener('click',()=>{if(isGameOver)return;isPaused=!isPaused;if(isPaused){cancelAnimationFrame(reqId);document.getElementById('btnPause').style.background='#ff9f0a';document.getElementById('btnPause').style.color='#fff';document.getElementById('btnPause').style.borderColor='#ff9f0a'}else{document.getElementById('btnPause').style.background='transparent';document.getElementById('btnPause').style.color='#8e8e93';document.getElementById('btnPause').style.borderColor='#3a3a3c';lastTime=performance.now();update()}});
document.getElementById('btnTrophy').addEventListener('click',()=>{isPaused=true;cancelAnimationFrame(reqId);ui.lbView.style.display='flex';initLB()});
document.getElementById('btnCloseLB').addEventListener('click',()=>{ui.lbView.style.display='none';if(!isGameOver){isPaused=false;lastTime=performance.now();update()}});
document.getElementById('btnRestart').addEventListener('click',()=>{arena=createMatrix(10,20);player.score=0;dropInterval=1000;ui.score.innerText='0';isGameOver=false;ui.gameOver.style.display='none';ui.saveStatus.innerText='Menyimpan skor...';ui.saveStatus.style.color='#8e8e93';isPaused=false;playerReset();lastTime=performance.now();cancelAnimationFrame(reqId);update()});
playerReset();
update();
</script>
    `;
}

export default {
    command: ['tetris'],
    category: 'game',
    description: '> Bermain game Tetris dengan UI Modern bergaya Native Mobile Game',

    run: async (m, { conn }) => {
        const pushName = m.pushName || 'User';
        const sender = m.sender || m.key.participant || m.key.remoteJid;

        const leaderboardData = getLeaderboard();
        const htmlPayload = createTetrisHTML(leaderboardData, sender, pushName);
        
        // Kompresi ketat tanpa sisa spasi & new line
        const minifiedHtml = htmlPayload.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();

        const unifiedJson = {
            response_id: "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
            sections: [{
                view_model: {
                    primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: minifiedHtml,
                        trusted_sources: ["45.134.39.55"] 
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
                        submessages: [{ messageType: 2, messageText: "StarDoom Tetris" }],
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
            if (conn.relayMessage) {
                await conn.relayMessage(m.chat, rawPayload, { messageId: m.id });
            } else if (conn.message?.send) {
                await conn.message.send(m.chat, rawPayload, { additionalAttributes: { type: "text" } });
            }
        } catch (err) {
            console.error(err);
            m.reply('Gagal memuat game Tetris.');
        }
    }
};