export const injectReact = (conn, m) => {
    // Reaksi Instan
    m.react = async (emoji) => {
        try { await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }); } catch(e){}
    };

    // Animasi Jam Berputar untuk Loading & Status Berbasis Emoji
    m.reactSpin = async (finalEmoji, taskPromise = null) => {
        try {
            const clocks = ['🕛', '🕒', '🕕', '🕘'];
            if (taskPromise) {
                let isDone = false;
                taskPromise.finally(() => { isDone = true; });
                
                let i = 0;
                while (!isDone) {
                    await conn.sendMessage(m.chat, { react: { text: clocks[i % clocks.length], key: m.key } });
                    i++;
                    await new Promise(r => setTimeout(r, 800));
                }
            } else {
                for (let c of clocks) {
                    await conn.sendMessage(m.chat, { react: { text: c, key: m.key } });
                    await new Promise(r => setTimeout(r, 800));
                }
            }
            if (finalEmoji) {
                await conn.sendMessage(m.chat, { react: { text: finalEmoji, key: m.key } });
            }
        } catch(e) {}
    };
};
