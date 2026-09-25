const html = `<html>
<head>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; }
  body { background: #0a0a14; display: flex; justify-content: center; align-items: center; width: 100%; min-height: 100vh; padding: 10px; }
  .card { width: 100%; max-width: 360px; background: linear-gradient(145deg, #0f0c29, #302b63, #24243e); border-radius: 16px; padding: 16px; color: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
  .avatar { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #8b5cf6; flex-shrink: 0; }
  .user-info { flex: 1; min-width: 0; }
  .name { font-size: 16px; font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .phone { font-size: 11px; color: #a78bfa; letter-spacing: 0.5px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .box { background: rgba(0, 0, 0, 0.3); border-radius: 10px; padding: 10px; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
  .box-title { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .box-val { font-size: 14px; font-weight: bold; color: #fff; }
  .tier-val { color: #facc15; }
  .verif-box { grid-column: span 2; background: rgba(0,0,0,0.35); display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
  .verif-status { font-weight: bold; font-size: 13px; color: ${verifColor}; }
  .footer { text-align: center; font-size: 8px; color: #6b7280; margin-top: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <img src="${ppUrl}" alt="Avatar" class="avatar" />
    <div class="user-info">
      <div class="name">${name}</div>
      <div class="phone">${displayNum}</div>
    </div>
  </div>
  <div class="grid">
    <div class="box">
      <div class="box-title">Tier Class</div>
      <div class="box-val tier-val">${userTier}</div>
    </div>
    <div class="box">
      <div class="box-title">Limit</div>
      <div class="box-val">${limitDisplay}</div>
    </div>
    <div class="box">
      <div class="box-title">Global Hit</div>
      <div class="box-val">${hitCount.toLocaleString()}</div>
    </div>
    <div class="box">
      <div class="box-title">Warns</div>
      <div class="box-val" style="color: ${warnCount > 0 ? '#ef4444' : '#fff'};">${warnCount}</div>
    </div>
    <div class="box verif-box">
      <div class="box-title" style="margin:0;">Status</div>
      <div class="verif-status">${verifText}</div>
    </div>
  </div>
  <div class="footer">STARDOOM UNIVERSE • USER PROFILE</div>
</div>
</body>
</html>`;