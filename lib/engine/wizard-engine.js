import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lockPath = path.join(__dirname, 'session-locks.json');

export function setWizardLock(jid, chat, type) {
    let locks = {};
    if (fs.existsSync(lockPath)) {
        try { locks = JSON.parse(fs.readFileSync(lockPath, 'utf-8')); } catch (e) {}
    }
    
    if (!locks[chat]) locks[chat] = {};
    locks[chat][jid] = { type, time: Date.now() };
    
    fs.writeFileSync(lockPath, JSON.stringify(locks, null, 2));

    // Sistem Auto-Destroy dalam 5 Menit
    setTimeout(() => {
        deleteWizardLock(jid, chat);
    }, 5 * 60 * 1000);
}

export function getWizardLock(jid, chat) {
    if (!fs.existsSync(lockPath)) return null;
    try {
        const locks = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        if (locks[chat] && locks[chat][jid]) {
            // Verifikasi masa berlaku sesi
            if (Date.now() - locks[chat][jid].time > 5 * 60 * 1000) {
                deleteWizardLock(jid, chat);
                return null;
            }
            return locks[chat][jid].type;
        }
    } catch (e) {}
    return null;
}

export function deleteWizardLock(jid, chat) {
    if (!fs.existsSync(lockPath)) return;
    try {
        let locks = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        if (locks[chat] && locks[chat][jid]) {
            delete locks[chat][jid];
            fs.writeFileSync(lockPath, JSON.stringify(locks, null, 2));
        }
    } catch (e) {}
}