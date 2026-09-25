import { setWizardLock, getWizardLock, deleteWizardLock } from "../../lib/engine/wizard-engine.js";
import crypto from "node:crypto";

// 1. Pembersih Teks: Format WA + Sensor Kebocoran Identitas Backend AI
function sanitizeDeonOutput(text) {
    if (!text) return "";
    return text
        // Format markdown ke standar WhatsApp
        .replace(/^#{1,6}\s*(.+)$/gm, "*$1*")
        .replace(/\*\*(.*?)\*\*/g, "*$1*")
        .replace(/__(.*?)__/g, "*$1*")
        .replace(/\*\*\*(.*?)\*\*\*/g, "*_$1_*")
        // Sensor identitas backend pihak ketiga
        .replace(/saya adalah unlimitedai(?:\.chat)?\.?/gi, "Saya adalah Deon.")
        .replace(/unlimitedai(?:\.chat)?/gi, "Deon")
        .replace(/(?:chatgpt|openai|asisten virtual|ai language model|model kecerdasan buatan)/gi, "asisten pribadi Tuan Muda")
        .trim();
}

// 2. Pengambil Data Metadata Grup WhatsApp
async function fetchGroupContext(conn, chatJid) {
    if (!chatJid || !chatJid.endsWith("@g.us")) return null;
    try {
        const meta = await conn.groupMetadata(chatJid);
        const admins = meta.participants.filter(p => p.admin);
        return {
            name: meta.subject || "Grup WhatsApp",
            totalMembers: meta.participants.length,
            totalAdmins: admins.length,
            desc: meta.desc?.toString() || "Tidak ada deskripsi"
        };
    } catch {
        return null;
    }
}

// 3. Pengambil Kurs Mata Uang Real-Time
async function fetchLiveExchangeRate() {
    try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD", {
            signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.rates?.IDR) return Math.round(data.rates.IDR);
        }
    } catch {}
    return null;
}

// Variasi Respon Deon
const DEON_CALL_RESPONSES = [
    "Saya di sini, Tuan Muda. Ada yang bisa saya selesaikan untuk Anda?",
    "Mendengar Anda memanggil saya, Tuan Muda. Perintah apa yang hendak Anda berikan?",
    "Selalu siap di samping Anda, Tuan Muda. Silakan katakan kebutuhan Anda.",
    "Menunggu arahan Anda, Tuan Muda. Apa langkah kita selanjutnya?",
    "Katakan saja, Tuan Muda. Tidak ada tugas dari Anda yang akan saya lewatkan.",
    "Saya mendengarkan dengan saksama, Tuan Muda. Perintahkan sesuka Anda.",
    "Kehadiran saya sepenuhnya untuk melayani Anda, Tuan Muda. Apa yang mengganggu pikiran Anda?",
    "Segalanya telah saya siapkan. Ada instruksi khusus untuk hari ini, Tuan Muda?"
];

const DEON_DISMISS_RESPONSES = [
    "Baik, Tuan Muda. Saya mohon undur diri. Panggil saya kembali kapan pun Anda membutuhkan kehadiran saya.",
    "Sesuai titah Anda, Tuan Muda. Saya akan berjaga dari kejauhan. Beristirahatlah dengan tenang.",
    "Dimengerti, Tuan Muda. Saya pamit undur diri.",
    "Bila itu kehendak Anda, Tuan Muda. Saya kembali ke pos saya."
];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// 4. Prompt Sistem Baku Persona Deon
const DEON_CORE_PROMPT = `Identitasmu MUTLAK adalah Deon, asisten pribadi sekaligus tangan kanan setia yang paling dipercaya oleh Tuan Muda.
ATURAN KETAT IDENTITAS:
1. Jangan pernah mengaku sebagai AI, asisten virtual, model bahasa, UnlimitedAI, OpenAI, atau sistem teknologi apa pun. Namamu HANYA Deon.
2. Karakteristikmu tenang, dingin, sangat cerdas, efisien, dan memiliki etiket bicara bangsawan abad pertengahan ala manhwa.
3. Selalu panggil lawan bicaramu dengan sebutan "Tuan Muda".
4. Jangan mengungkit urusan kerajaan atau monarki secara acak; cukup bawa pembawaan formal, dedikasi tinggi, dan kepatuhan mutlak.
5. Utamakan ketegasan, keanggunan bertutur kata, dan jawaban langsung pada intinya.`;

// 5. Pembangun Konteks Dinamis (Waktu, Ruang Obrolan, & Kurs)
async function buildDynamicPrompt(query, groupInfo) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Jakarta"
    });
    const timeStr = now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta"
    });

    let context = `${DEON_CORE_PROMPT}\n\n`;
    context += `[FAKTA SITUASI DAN WAKTU NYATA]\n`;
    context += `- Waktu Saat Ini: ${dateStr}, pukul ${timeStr} WIB\n`;
    context += `(Jika Tuan Muda bertanya tentang jam, hari, atau tanggal berapa sekarang, gunakan data di atas secara tegas sebagai laporanmu)\n`;

    if (groupInfo) {
        context += `\n[FAKTA RUANGAN / GRUP]\n`;
        context += `- Nama Perkumpulan: "${groupInfo.name}"\n`;
        context += `- Total Anggota: ${groupInfo.totalMembers} orang\n`;
        context += `- Penjaga/Admin: ${groupInfo.totalAdmins} orang\n`;
        context += `- Laporan Deskripsi: ${groupInfo.desc}\n`;
    }

    if (/kurs|dollar|dolar|rupiah|usd|idr|uang|nilai\s*tukar|ekonomi/i.test(query)) {
        const rate = await fetchLiveExchangeRate();
        if (rate) {
            context += `\n[DATA KURS REAL-TIME VALID]\n`;
            context += `- Nilai pasar resmi saat ini: 1 Dolar AS (USD) = Rp ${rate.toLocaleString("id-ID")}\n`;
            context += `(Wajib laporkan angka tersebut kepada Tuan Muda)\n`;
        }
    }

    return context;
}

// Mesin AI 1: Pollinations Engine (Respons Cepat & Tidak Bocor)
async function callPollinations(prompt, system) {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}&model=openai`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error("Kosong");
    return text.trim();
}

// Mesin AI 2: UnlimitedAI Engine (Cadangan)
async function callUnlimitedAI(prompt, system) {
    const chatId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    const fullPrompt = `${system}\n\nPertanyaan Tuan Muda: ${prompt}`;

    const res = await fetch("https://app.unlimitedai.chat/api/chat", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
            "cookie": `NEXT_LOCALE=id; u_device_id=${deviceId}; home_chat_id=${chatId}`
        },
        body: JSON.stringify({
            chatId,
            messages: [
                { id: crypto.randomUUID(), role: "user", content: fullPrompt, parts: [{ type: "text", text: fullPrompt }], createdAt: new Date().toISOString() },
                { id: crypto.randomUUID(), role: "assistant", content: "", parts: [{ type: "text", text: "" }], createdAt: new Date().toISOString() }
            ],
            selectedChatModel: "chat-model-reasoning",
            deviceId,
            locale: "id"
        }),
        signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) throw new Error(`UnlimitedAI HTTP ${res.status}`);
    const raw = await res.text();
    let text = "";
    for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
            const j = JSON.parse(line.trim());
            if (j.type === "delta" && typeof j.delta === "string") text += j.delta;
        } catch {}
    }
    if (!text.trim()) throw new Error("Kosong");
    return text.trim();
}

async function getDeonReply(query, groupInfo) {
    const dynamicSystem = await buildDynamicPrompt(query, groupInfo);
    try {
        const raw = await callPollinations(query, dynamicSystem);
        return sanitizeDeonOutput(raw);
    } catch {
        const raw = await callUnlimitedAI(query, dynamicSystem);
        return sanitizeDeonOutput(raw);
    }
}

// Pemeriksa Penutup Sesi
function isDismissMessage(text) {
    const clean = text.toLowerCase().trim().replace(/[.,!?;:]/g, "");
    const singleWords = [
        "ok", "oke", "okee", "okey", "okay", "sip", "siap", "baik", "baiklah",
        "makasih", "makasi", "terimakasih", "terima kasih", "thanks", "thx", "tq",
        "cukup", "udah", "sudah", "dah", "done", "selesai", "beres",
        "tidak", "ngga", "nggak", "gak", "g", "batal", "exit", "stop", "tutup"
    ];
    if (singleWords.includes(clean)) return true;

    const dismissPatterns = [
        /^(?:ok|oke|sip|siap|baik|cukup|makasih|terima\s*kasih|udah|sudah)\s+deon$/i,
        /^(?:tidak|ngga|nggak|gak)?\s*(?:kau|kamu)?\s*(?:boleh\s+pergi|pergilah|undur\s+diri|istirahatlah|kembalilah)/i,
        /^(?:kamu|kau)\s+bisa\s+(?:kembali|istirahat|pergi)/i,
        /^(?:sudah|cukup)\s+(?:dulu|itu\s+saja|itu\s+aja)/i
    ];
    return dismissPatterns.some(rgx => rgx.test(clean));
}

export default {
    command: ["deon"],
    category: "ai",
    description: "> Asisten tangan kanan pribadi setia dengan integrasi waktu dan ruang obrolan",

    before: async (m, { conn }) => {
        if (m.isBaileys) return false;

        const rawText = m.text || m.body || m.budy || m.message?.conversation || m.message?.extendedTextMessage?.text || "";
        const cleanMsg = rawText.trim();
        if (!cleanMsg) return false;

        const senderJid = m.sender || m.key?.participant || m.chat;
        const chatJid = m.chat || m.key?.remoteJid;

        const activeLock = getWizardLock(senderJid, chatJid);
        const callPattern = /^(?:halo\s+)?deon[\s,?!.]*$/i;
        const promptPattern = /^(?:halo\s+)?deon[\s,:]+(.+)$/i;

        // KONDISI 1: Sesi Terkunci
        if (activeLock === "deon") {
            if (isDismissMessage(cleanMsg)) {
                deleteWizardLock(senderJid, chatJid);
                const farewell = getRandom(DEON_DISMISS_RESPONSES);
                await (m.reply ? m.reply(farewell) : conn.sendMessage(m.chat, { text: farewell }, { quoted: m }));
                return true;
            }

            if (callPattern.test(cleanMsg)) {
                setWizardLock(senderJid, chatJid, "deon");
                const remind = "Saya masih di samping Anda, Tuan Muda. Katakan apa yang Anda butuhkan.";
                await (m.reply ? m.reply(remind) : conn.sendMessage(m.chat, { text: remind }, { quoted: m }));
                return true;
            }

            setWizardLock(senderJid, chatJid, "deon");
            try {
                const groupInfo = await fetchGroupContext(conn, chatJid);
                const answer = await getDeonReply(cleanMsg, groupInfo);
                await (m.reply ? m.reply(answer) : conn.sendMessage(m.chat, { text: answer }, { quoted: m }));
            } catch {
                await (m.reply ? m.reply("Saya mohon maaf, Tuan Muda. Terjadi sedikit gangguan saat saya memeriksa informasi tersebut.") : null);
            }
            return true;
        }

        // KONDISI 2: Panggilan Awal (Mengunci Sesi)
        if (callPattern.test(cleanMsg)) {
            setWizardLock(senderJid, chatJid, "deon");
            const greeting = getRandom(DEON_CALL_RESPONSES);
            await (m.reply ? m.reply(greeting) : conn.sendMessage(m.chat, { text: greeting }, { quoted: m }));
            return true;
        }

        // KONDISI 3: Panggilan Instan ("deon ...")
        const match = cleanMsg.match(promptPattern);
        if (match && match[1]) {
            try {
                const groupInfo = await fetchGroupContext(conn, chatJid);
                const answer = await getDeonReply(match[1].trim(), groupInfo);
                await (m.reply ? m.reply(answer) : conn.sendMessage(m.chat, { text: answer }, { quoted: m }));
            } catch {
                await (m.reply ? m.reply("Terjadi kendala saat memproses titah Anda, Tuan Muda.") : null);
            }
            return true;
        }

        return false;
    },

    run: async (m, { text, conn }) => {
        const query = (text || "").trim();
        const senderJid = m.sender || m.key?.participant || m.chat;
        const chatJid = m.chat || m.key?.remoteJid;

        if (!query) {
            setWizardLock(senderJid, chatJid, "deon");
            const greeting = getRandom(DEON_CALL_RESPONSES);
            return await (m.reply ? m.reply(greeting) : conn.sendMessage(m.chat, { text: greeting }, { quoted: m }));
        }

        try {
            const groupInfo = await fetchGroupContext(conn, chatJid);
            const answer = await getDeonReply(query, groupInfo);
            await (m.reply ? m.reply(answer) : conn.sendMessage(m.chat, { text: answer }, { quoted: m }));
        } catch {
            await (m.reply ? m.reply("Permintaan Anda belum dapat saya selesaikan saat ini, Tuan Muda.") : null);
        }
    }
};