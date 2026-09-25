import { exec } from 'child_process';
import util from 'util';
import { sym } from '../global-symbol.js';

const execAsync = util.promisify(exec);

export async function handleTerminal(sock, msg, isOwner, text) {
    if (!isOwner || !text.startsWith('$')) return false;

    const cmd = text.slice(1).trim();
    if (!cmd) return false;

    const shell = process.platform === "win32" ? "powershell.exe" : "/bin/bash";
    const remoteJid = msg.key.remoteJid;
    
    await sock.sendMessage(remoteJid, { text: `${sym.arrowCurve} ${sym.swoosh} *EXECUTING TERMINAL* ${sym.sparkle}\n\n\`$ ${cmd}\`` }, { quoted: msg });
    
    try {
        const { stdout, stderr } = await execAsync(cmd, { shell, timeout: 60000 });
        const output = stdout || stderr || "No output";
        await sock.sendMessage(remoteJid, { text: `${sym.arrowCurve} ${sym.swoosh} *TERMINAL RESULT* ${sym.sparkle}\n\n\`$ ${cmd}\`\n\n\`\`\`\n${output.slice(0, 3500)}\n\`\`\`` });
    } catch (err) {
        const errorMsg = err.stderr || err.stdout || err.message;
        await sock.sendMessage(remoteJid, { text: `${sym.arrowCurve} ${sym.swoosh} *TERMINAL ERROR* ${sym.sparkle}\n\n\`$ ${cmd}\`\n\n\`\`\`\n${errorMsg.slice(0, 3500)}\n\`\`\`` });
    }
    
    return true; 
}
