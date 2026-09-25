import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database', 'yapper.json');

function loadDb() {
    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch {
        return {};
    }
}

function saveDb(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export default {
    command: ['topyapper', 'yapper'],
    category: 'group',
    description: 'Menampilkan peringkat 5 teratas anggota paling aktif di grup',

    before: async (m, { isGroup }) => {
        if (!isGroup || !m.sender || !m.chat || m.key.fromMe) return false;

        const db = loadDb();
        const chatId = m.chat;
        const sender = m.sender;

        if (!db[chatId]) {
            db[chatId] = {
                groupId: chatId,
                members: {}
            };
        }

        if (!db[chatId].members[sender]) {
            db[chatId].members[sender] = {
                userId: sender,
                count: 0,
                firstSeen: Date.now()
            };
        }

        db[chatId].members[sender].count += 1;
        saveDb(db);

        return false;
    },

    run: async (m, { isGroup }) => {
        if (!isGroup) {
            return m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        }

        const db = loadDb();
        const groupData = db[m.chat];

        if (!groupData || !groupData.members || Object.keys(groupData.members).length === 0) {
            return m.reply('Belum ada data aktivitas yang tercatat di grup ini.');
        }

        const members = Object.values(groupData.members);
        const sortedMembers = members.sort((a, b) => b.count - a.count);
        const top5 = sortedMembers.slice(0, 5);

        let mentions = [m.sender];

        let text = `Berikut adalah data anggota paling aktif di grup ini, @${m.sender.split('@')[0]}\n\n`;
        text += `╰› ᯓ *TOP YAPPER GROUP* ˎˊ˗\n\n`;
        text += `*Detail Aktivitas :*\n\n`;

        for (let i = 0; i < top5.length; i++) {
            const member = top5[i];
            if (!mentions.includes(member.userId)) mentions.push(member.userId);

            const firstSeen = member.firstSeen || Date.now();
            const daysActive = Math.max(1, Math.ceil((Date.now() - firstSeen) / (1000 * 60 * 60 * 24)));
            const avgDaily = Math.max(1, Math.round(member.count / daysActive));

            text += `• Peringkat ${i + 1} : @${member.userId.split('@')[0]}\n`;
            text += `• Pesan : ${member.count} Pesan\n`;
            text += `• Pesan Harian : ${avgDaily} Pesan per-hari\n\n`;
        }

        text += `Data aktivitas grup tersebut telah tersinkronisasi dan diurutkan secara real-time.`;

        await m.reply(text.trim(), m.chat, { 
            mentions: mentions,
            footer: 'メ ©Nameless StarDoom' 
        });
    }
};