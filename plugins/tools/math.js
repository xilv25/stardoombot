import crypto from 'node:crypto';
import greetEngine from '../../lib/engine/greet-engine.js';

// 1. Ekstraksi Teks Input Langsung atau Reply
function extractInputText(m, text) {
    if (text && text.trim()) return text.trim();

    const candidates = [
        m.quoted?.text,
        m.quoted?.body,
        m.quoted?.caption,
        m.quoted?.conversation,
        m.quoted?.message?.conversation,
        m.quoted?.message?.extendedTextMessage?.text
    ];

    for (let c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return '';
}

// 2. Format Angka Standar Indonesia (Titik Ribuan & Koma Desimal)
function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return num;
    const parts = num.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
}

// 3. Evaluasi Aritmetika Numerik Cepat (Tanpa Jaringan)
function evaluateArithmetic(expr) {
    const clean = expr
        .replace(/×/g, '*')
        .replace(/x/gi, '*')
        .replace(/÷/g, '/')
        .replace(/:/g, '/')
        .replace(/,/g, '.')
        .replace(/\^/g, '**');

    if (!/^[0-9+\-*/().\s*]+$/.test(clean)) return null;

    try {
        const result = Function(`'use strict'; return (${clean})`)();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            return result;
        }
    } catch {
        return null;
    }
    return null;
}

// 4. Pembersih Format: Hapus Basa-Basi AI & Konversi LaTeX ke Notasi Matematika Bersih
function cleanMathOutput(text) {
    if (!text) return '';
    return text
        // Sensor sapaan dan perkenalan AI
        .replace(/^(?:halo|hai|selamat|saya|tentu|berikut).*?(?:\n|:)/gi, '')
        .replace(/unlimitedai(?:\.chat)?/gi, '')
        .replace(/(?:chatgpt|openai|asisten virtual|model bahasa)/gi, '')
        // Bersihkan sintaks LaTeX bawaan AI
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\cdot/g, '·')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
        .replace(/\\\[|\\\]|\\\(|\\\)/g, '')
        .replace(/\$/g, '')
        // Standarisasi Markdown WhatsApp
        .replace(/^#{1,6}\s*(.+)$/gm, '*$1*')
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/__(.*?)__/g, '*$1*')
        .trim();
}

// System Prompt Khusus: HANYA Rumus Asli & Substitusi Angka
const MATH_SYSTEM_PROMPT = 
    'Kamu adalah kalkulator solver matematika murni tanpa kepribadian. ' +
    'ATURAN MUTLAK:\n' +
    '1. JANGAN PERNAH menyapa, memperkenalkan diri, menyebut nama AI, atau mengulang teks soal.\n' +
    '2. DILARANG menggunakan format LaTeX seperti \\text{}, \\times, atau simbol dolar $. Gunakan simbol teks biasa (×, ÷, +, -, =).\n' +
    '3. Langsung sajikan rumus resmi matematika, langkah hitung substitusi angka, dan hasil akhir secara ringkas.\n' +
    '4. Susun keluaran PERSIS dalam struktur berikut:\n\n' +
    '*Rumus :*\n<rumus baku matematika>\n\n' +
    '*Perhitungan :*\n<langkah substitusi angka step-by-step>\n\n' +
    '*Hasil Akhir :*\n<nilai akhir>';

// Mesin AI 1: UnlimitedAI Reasoning Engine
async function callUnlimitedAI(prompt) {
    const chatId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    const fullPrompt = `${MATH_SYSTEM_PROMPT}\n\nSoal:\n${prompt}`;

    const res = await fetch('https://app.unlimitedai.chat/api/chat', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'cookie': `NEXT_LOCALE=id; u_device_id=${deviceId}; home_chat_id=${chatId}`
        },
        body: JSON.stringify({
            chatId,
            messages: [
                { id: crypto.randomUUID(), role: 'user', content: fullPrompt, parts: [{ type: 'text', text: fullPrompt }], createdAt: new Date().toISOString() },
                { id: crypto.randomUUID(), role: 'assistant', content: '', parts: [{ type: 'text', text: '' }], createdAt: new Date().toISOString() }
            ],
            selectedChatModel: 'chat-model-reasoning',
            deviceId,
            locale: 'id'
        }),
        signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    let text = '';
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
            const j = JSON.parse(line.trim());
            if (j.type === 'delta' && typeof j.delta === 'string') {
                text += j.delta;
            }
        } catch {}
    }
    if (!text.trim()) throw new Error('Kosong');
    return text.trim();
}

// Mesin AI 2: Pollinations Engine (Cadangan Cepat)
async function callPollinations(prompt) {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(MATH_SYSTEM_PROMPT)}&model=openai`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error('Kosong');
    return text.trim();
}

async function solveMathAI(query) {
    try {
        const raw = await callUnlimitedAI(query);
        return cleanMathOutput(raw);
    } catch {
        const raw = await callPollinations(query);
        return cleanMathOutput(raw);
    }
}

export default {
    command: ['math', 'm', 'tambah', 'kurang', 'kali', 'bagi', 'solusi'],
    category: 'tools',
    description: '> Kalkulator instan dan pemecah rumus matematika presisi',

    run: async (m, { conn, text, command, usedPrefix, isOwner, isAdmin, fakereply }) => {
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command ? command.toLowerCase() : 'math';

        // Fakereply Mandiri (Tanpa Watermark)
        const pushName = m.pushName || 'User';
        const fake = fakereply || {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: pushName,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        const sendSafe = async (content) => {
            try {
                return await conn.sendMessage(m.chat, { text: content }, { quoted: fake });
            } catch {
                return await conn.sendMessage(m.chat, { text: content });
            }
        };

        // Greet Engine
        let greeting = '';
        try {
            const fnGreet = typeof greetEngine === 'function' ? greetEngine : (greetEngine?.getGreeting || greetEngine?.default);
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner, isAdmin });
                greeting = typeof res === 'object' ? (res.prefix || res.text || '') : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            greeting = `Selamat ${ucapan} ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${pushName}*,`;
        }

        // Panduan Penggunaan (.math)
        if (cmd === 'math') {
            return await sendSafe(
                `${greeting} berikut panduan fitur matematika dan kalkulator.\n\n` +
                `╰› ᯓ *SYSTEM INFORMATION* ˎˊ˗\n\n` +
                `*Kalkulator Aritmetika Cepat :*\n` +
                `• \`${pfx}m 50 + 25 * (10 - 2)\`\n` +
                `• \`${pfx}m 125 * 4\`\n\n` +
                `*Operasi Kata Kunci :*\n` +
                `• \`${pfx}tambah 123 123\`\n` +
                `• \`${pfx}kurang 200 75\`\n` +
                `• \`${pfx}kali 25 4\`\n` +
                `• \`${pfx}bagi 100 4\`\n\n` +
                `*Solver Rumus & Soal Cerita :*\n` +
                `• \`${pfx}m Baju seharga 1 juta diskon 50%, berapa bayarnya?\`\n` +
                `• \`${pfx}m Alas segitiga 12 cm, tinggi 8 cm. Hitung luasnya\`\n` +
                `• \`${pfx}m Selesaikan persamaan 2x + 10 = 30\`\n\n` +
                `> Mendukung teks langsung di belakang perintah atau dengan membalas (*reply*) pesan.`
            );
        }

        const input = extractInputText(m, text);

        if (!input) {
            return await sendSafe(
                `${greeting} angka atau soal matematika belum dimasukkan.\n\n` +
                `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                `Ketik \`${pfx}math\` untuk melihat contoh format penggunaannya.`
            );
        }

        // Operasi Kata Kunci Cepat
        if (['tambah', 'kurang', 'kali', 'bagi'].includes(cmd)) {
            const rawNumbers = input.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g);

            if (!rawNumbers || rawNumbers.length < 2) {
                return await sendSafe(
                    `${greeting} masukkan minimal dua angka untuk melakukan operasi.\n` +
                    `Contoh: \`${pfx}${cmd} 150 25\``
                );
            }

            const nums = rawNumbers.map(Number);
            let result = nums[0];
            let symbol = '';

            if (cmd === 'tambah') {
                symbol = '+';
                result = nums.reduce((a, b) => a + b);
            } else if (cmd === 'kurang') {
                symbol = '-';
                result = nums.slice(1).reduce((a, b) => a - b, nums[0]);
            } else if (cmd === 'kali') {
                symbol = '×';
                result = nums.reduce((a, b) => a * b);
            } else if (cmd === 'bagi') {
                symbol = ':';
                for (let i = 1; i < nums.length; i++) {
                    if (nums[i] === 0) {
                        return await sendSafe(`${greeting} angka pembagi tidak boleh bernilai 0 (pembagian dengan nol tak terdefinisi).`);
                    }
                    result /= nums[i];
                }
            }

            const equation = nums.join(` ${symbol} `);
            return await sendSafe(
                `${greeting} perhitungan berhasil diproses.\n\n` +
                `╰› ᯓ *CALCULATION SUCCESS* ˎˊ˗\n\n` +
                `• *Operasi :* ${equation}\n` +
                `• *Hasil Akhir :* *${formatNumber(result)}*`
            );
        }

        // Aritmetika Numerik Murni (Instan)
        const directMath = evaluateArithmetic(input);
        if (directMath !== null) {
            return await sendSafe(
                `${greeting} perhitungan berhasil diproses.\n\n` +
                `╰› ᯓ *CALCULATION SUCCESS* ˎˊ˗\n\n` +
                `• *Soal :* ${input}\n` +
                `• *Hasil Akhir :* *${formatNumber(directMath)}*`
            );
        }

        // Pemecahan Soal Cerita / Aljabar / Rumus via AI
        try {
            const solution = await solveMathAI(input);

            await sendSafe(
                `${greeting} solusi perhitungan berhasil ditemukan.\n\n` +
                `╰› ᯓ *MATHEMATICS BREAKDOWN* ˎˊ˗\n\n` +
                `${solution}`
            );

        } catch (e) {
            console.error('[Math Engine Error]:', e);
            await sendSafe(
                `${greeting} perhitungan gagal diselesaikan.\n\n` +
                `╰› ᯓ *SYSTEM ERROR* ˎˊ˗\n\n` +
                `• *Pesan :* ${e.message || 'Kendala koneksi ke server matematika.'}`
            );
        }
    }
};