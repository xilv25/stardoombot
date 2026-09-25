import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Format angka ringkas (K, M, B)
function formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace('.0', '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
}

// Deteksi font sistem untuk tampilan modern
function getModernFonts() {
    const boldCandidates = [
        '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf',
        '/usr/share/fonts/truetype/roboto/unhinted/Roboto-Bold.ttf',
        '/usr/share/fonts/truetype/roboto/Roboto-Bold.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        'C:\\Windows\\Fonts\\segoeui.ttf',
        'C:\\Windows\\Fonts\\arialbd.ttf'
    ];

    const regCandidates = [
        '/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf',
        '/usr/share/fonts/truetype/roboto/unhinted/Roboto-Regular.ttf',
        '/usr/share/fonts/truetype/roboto/Roboto-Regular.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        'C:\\Windows\\Fonts\\segoeui.ttf',
        'C:\\Windows\\Fonts\\arial.ttf'
    ];

    const foundBold = boldCandidates.find(f => fs.existsSync(f));
    const foundReg = regCandidates.find(f => fs.existsSync(f)) || foundBold;

    return {
        bold: foundBold ? `:fontfile='${foundBold}'` : '',
        reg: foundReg ? `:fontfile='${foundReg}'` : ''
    };
}

// Scraper profil TikTok dengan fallback otomatis
async function scrapeTikTokProfile(username) {
    const cleanUser = username.replace(/^@/, '').trim();
    
    // Metode 1: Web resmi TikTok
    try {
        const url = `https://www.tiktok.com/@${cleanUser}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        if (response.ok) {
            const html = await response.text();
            
            const rehydrationMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
            if (rehydrationMatch && rehydrationMatch[1]) {
                const parsed = JSON.parse(rehydrationMatch[1].trim());
                const userInfo = parsed.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
                if (userInfo?.user) {
                    return {
                        username: userInfo.user.uniqueId || cleanUser,
                        nickname: userInfo.user.nickname || cleanUser,
                        avatar: userInfo.user.avatarLarger || userInfo.user.avatarMedium || userInfo.user.avatarThumb,
                        bio: userInfo.user.signature || '-',
                        isVerified: Boolean(userInfo.user.verified),
                        followers: userInfo.stats?.followerCount || 0,
                        following: userInfo.stats?.followingCount || 0,
                        likes: userInfo.stats?.heartCount || 0,
                        posts: userInfo.stats?.videoCount || 0
                    };
                }
            }

            const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
            if (sigiMatch && sigiMatch[1]) {
                const parsed = JSON.parse(sigiMatch[1].trim());
                const userObj = Object.values(parsed.UserModule?.users || {})[0];
                const statsObj = Object.values(parsed.UserModule?.stats || {})[0];
                if (userObj) {
                    return {
                        username: userObj.uniqueId || cleanUser,
                        nickname: userObj.nickname || cleanUser,
                        avatar: userObj.avatarLarger || userObj.avatarMedium || userObj.avatarThumb,
                        bio: userObj.signature || '-',
                        isVerified: Boolean(userObj.verified),
                        followers: statsObj?.followerCount || 0,
                        following: statsObj?.followingCount || 0,
                        likes: statsObj?.heartCount || 0,
                        posts: statsObj?.videoCount || 0
                    };
                }
            }
        }
    } catch {}

    // Metode 2: Cadangan API
    try {
        const fallbackRes = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanUser)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const json = await fallbackRes.json();
        
        if (json.code === 0 && json.data?.user) {
            const u = json.data.user;
            const s = json.data.stats || {};
            return {
                username: u.uniqueId || cleanUser,
                nickname: u.nickname || cleanUser,
                avatar: u.avatarLarger || u.avatarMedium || u.avatarThumb,
                bio: u.signature || '-',
                isVerified: Boolean(u.verified),
                followers: s.followerCount || 0,
                following: s.followingCount || 0,
                likes: s.heartCount || 0,
                posts: s.videoCount || 0
            };
        }
    } catch {}

    throw new Error('Akun tidak ditemukan, bersifat privat, atau dibatasi oleh TikTok.');
}

// Generator kartu profil via FFmpeg dengan avatar lingkaran
async function renderProfileCard(profile) {
    const tmpDir = os.tmpdir();
    const avatarPath = path.join(tmpDir, `ttpf_ava_${Date.now()}.jpg`);
    const outputPath = path.join(tmpDir, `ttpf_out_${Date.now()}.png`);

    try {
        const res = await fetch(profile.avatar, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.tiktok.com/'
            }
        });
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(avatarPath, buffer);

        const fonts = getModernFonts();

        const escapeText = (str) => str.replace(/[^a-zA-Z0-9 ._@\-]/g, '').trim();
        const name = escapeText(profile.nickname).slice(0, 16) || 'TikTok User';
        const user = '@' + escapeText(profile.username).slice(0, 18);
        const fFollowers = formatNumber(profile.followers);
        const fFollowing = formatNumber(profile.following);
        const fLikes = formatNumber(profile.likes);
        const fPosts = formatNumber(profile.posts);

        // Filter FFmpeg: Kartu gelap elegan, avatar bundar, dan tata letak statistik modern
        const filterComplex = [
            `[0:v]drawbox=x=25:y=25:w=800:h=330:color=0x1E1F24@1:t=fill[card]`,
            // Pemotongan lingkaran avatar (180x180) dengan kurva alfa
            `[1:v]scale=180:180:force_original_aspect_ratio=increase,crop=180:180,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-90,Y-90),90),255,0)'[circle_ava]`,
            `[card][circle_ava]overlay=x=65:y=100[with_ava]`,
            // Garis pembatas halus
            `[with_ava]drawbox=x=280:y=185:w=510:h=2:color=0x2E3038@1:t=fill[line]`,
            // Nama & Username
            `[line]drawtext=text='${name}'${fonts.bold}:fontcolor=0xFFFFFF:fontsize=36:x=280:y=95[t1]`,
            `[t1]drawtext=text='${user}'${fonts.reg}:fontcolor=0x8A8B91:fontsize=22:x=280:y=142[t2]`,
            // Baris angka statistik (Following, Followers, Likes, Videos)
            `[t2]drawtext=text='${fFollowing}'${fonts.bold}:fontcolor=0xFFFFFF:fontsize=30:x=280:y=210[s1]`,
            `[s1]drawtext=text='${fFollowers}'${fonts.bold}:fontcolor=0xFFFFFF:fontsize=30:x=410:y=210[s2]`,
            `[s2]drawtext=text='${fLikes}'${fonts.bold}:fontcolor=0xFFFFFF:fontsize=30:x=540:y=210[s3]`,
            `[s3]drawtext=text='${fPosts}'${fonts.bold}:fontcolor=0xFFFFFF:fontsize=30:x=670:y=210[s4]`,
            // Label statistik
            `[s4]drawtext=text='Following'${fonts.reg}:fontcolor=0x8A8B91:fontsize=17:x=280:y=255[l1]`,
            `[l1]drawtext=text='Followers'${fonts.reg}:fontcolor=0x8A8B91:fontsize=17:x=410:y=255[l2]`,
            `[l2]drawtext=text='Likes'${fonts.reg}:fontcolor=0x8A8B91:fontsize=17:x=540:y=255[l3]`,
            `[l3]drawtext=text='Videos'${fonts.reg}:fontcolor=0x8A8B91:fontsize=17:x=670:y=255`
        ].join(';');

        const ffmpegCmd = `ffmpeg -y -f lavfi -i color=c=0x121214:s=850x380:d=1 -i "${avatarPath}" -filter_complex "${filterComplex}" -frames:v 1 "${outputPath}"`;
        await execPromise(ffmpegCmd);

        const imageBuffer = fs.readFileSync(outputPath);
        return imageBuffer;
    } finally {
        if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}

export default {
    command: ['tiktokprofile', 'ttpf', 'ttprofile'],
    category: 'tools',
    description: 'Melihat kartu profil TikTok pengguna lengkap dengan statistik',
    run: async (m, { conn, args, usedPrefix, command, isOwner, isAdmin }) => {
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        const { sym } = await import(`file://${symPath}`);

        const pushName = m.pushName || 'Master';
        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: { contactMessage: { displayName: pushName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
        };

        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner, isAdmin });
        } catch {
            greet = { prefix: `Halo Anda,` };
        }

        const username = args[0];
        if (!username) {
            let msg = `${greet.prefix} parameter username TikTok belum dilampirkan.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *TIKTOK PROFILE* ${sym.sparkle}\n\n`;
            msg += `*Panduan Penggunaan :*\n\n`;
            msg += `• \`${usedPrefix + command} <username>\`\n`;
            msg += `• Contoh : \`${usedPrefix + command} khaby.lame\``;

            return conn.sendMessage(m.chat, { text: msg }, { quoted: fakeReply });
        }

        try {
            const profile = await scrapeTikTokProfile(username);
            const cardBuffer = await renderProfileCard(profile);

            let caption = `${greet.prefix} data profil TikTok untuk *${profile.nickname}* berhasil dimuat.\n\n`;
            caption += `${sym.arrowCurve} ${sym.swoosh} *TIKTOK OVERVIEW* ${sym.sparkle}\n\n`;
            caption += `• *Nama* : ${profile.nickname} ${profile.isVerified ? '☑️' : ''}\n`;
            caption += `• *Username* : @${profile.username}\n`;
            caption += `• *Bio* : ${profile.bio}\n\n`;
            caption += `*Statistik Akun :*\n\n`;
            caption += `• Pengikut : ${formatNumber(profile.followers)} (${profile.followers.toLocaleString('id-ID')})\n`;
            caption += `• Mengikuti : ${formatNumber(profile.following)} (${profile.following.toLocaleString('id-ID')})\n`;
            caption += `• Disukai : ${formatNumber(profile.likes)} (${profile.likes.toLocaleString('id-ID')})\n`;
            caption += `• Total Video : ${formatNumber(profile.posts)} postingan`;

            await conn.sendMessage(m.chat, {
                image: cardBuffer,
                caption: caption
            }, { quoted: fakeReply });

        } catch (err) {
            let errMsg = `${greet.prefix} gagal mengambil profil TikTok yang diminta.\n\n`;
            errMsg += `${sym.arrowCurve} ${sym.swoosh} *PROFILE ERROR* ${sym.sparkle}\n\n`;
            errMsg += `• Kendala : ${err.message || 'Server TikTok tidak merespons'}\n\n`;
            errMsg += `Pastikan username akun publik dan ditulis dengan benar.`;

            return conn.sendMessage(m.chat, { text: errMsg }, { quoted: fakeReply });
        }
    }
};