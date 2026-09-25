import os from 'os';
import path from 'path';

function hexColor(hexCode) {
    return parseInt(hexCode.replace('#', '') + 'FF', 16);
}

export async function generateStatsCard(pluginCount) {
    try {
        const JimpModule = await import('jimp');
        let Jimp = JimpModule.default || JimpModule;
        // Tangani nesting ganda module import
        if (Jimp && Jimp.default) Jimp = Jimp.default;

        // Validasi ekstra: Jika Jimp masih belum menjadi fungsi konstruktor, lewati.
        if (typeof Jimp !== 'function') {
            console.log('[Stats Card Info] Menunggu instalasi ulang versi Jimp yang sesuai...');
            return null;
        }

        const width = 1000;
        const height = 1250;
        
        const image = new Jimp(width, height, hexColor('#0b0f19'));

        const font64 = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

        function drawRoundRect(img, rx, ry, rw, rh, radius, colorHex) {
            const color = hexColor(colorHex);
            img.scan(rx, ry, rw, rh, function (x, y) {
                let dx = 0, dy = 0;
                if (x < rx + radius) dx = rx + radius - x;
                else if (x > rx + rw - radius) dx = x - (rx + rw - radius);
                
                if (y < ry + radius) dy = ry + radius - y;
                else if (y > ry + rh - radius) dy = y - (ry + rh - radius);
                
                if (dx > 0 && dy > 0 && dx * dx + dy * dy > radius * radius) return;
                this.setPixelColor(color, x, y);
            });
        }

        function drawRing(img, cx, cy, radius, thickness, percent, hexFg, hexBg) {
            const fg = hexColor(hexFg);
            const bg = hexColor(hexBg);
            const outer = radius;
            const inner = radius - thickness;
            
            img.scan(cx - outer, cy - outer, outer * 2, outer * 2, function(x, y) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist >= inner && dist <= outer) {
                    let angle = Math.atan2(dy, dx) + (Math.PI / 2);
                    if (angle < 0) angle += 2 * Math.PI;
                    const targetAngle = percent * 2 * Math.PI;
                    this.setPixelColor(angle <= targetAngle ? fg : bg, x, y);
                }
            });
        }

        drawRoundRect(image, 50, 50, 900, 150, 20, '#131c2e');

        try {
            const logoPath = path.resolve('./src/stats/logo.jpg');
            const logo = await Jimp.read(logoPath);
            logo.resize(100, 100);
            
            logo.scan(0, 0, 100, 100, function(x, y, idx) {
                const dx = x - 50, dy = y - 50;
                if (dx * dx + dy * dy > 2500) this.bitmap.data[idx + 3] = 0;
            });
            image.composite(logo, 80, 75);
        } catch (e) {
            drawRoundRect(image, 80, 75, 100, 100, 50, '#3b82f6');
        }

        image.print(font64, 210, 80, 'STARDOOM UNIVERSE');
        image.print(font16, 215, 145, 'Powered by StarDoom Universe Core Engine');

        function drawCard(x, y, w, h, title) {
            drawRoundRect(image, x, y, w, h, 20, '#131c2e');
            if (title) image.print(font16, x + 30, y + 30, title);
        }

        drawCard(50, 230, 280, 320, 'CPU USAGE');
        drawRing(image, 190, 390, 70, 15, 0.09, '#3b82f6', '#1e293b');
        image.print(font32, 165, 375, '9%');

        drawCard(360, 230, 280, 320, 'MEMORY');
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const usedMem = (totalMem - freeMem).toFixed(2);
        const memPercent = Math.round((usedMem / totalMem) * 100);
        
        drawRing(image, 500, 390, 70, 15, memPercent / 100, '#f97316', '#1e293b');
        image.print(font32, 465, 375, `${memPercent}%`);
        image.print(font16, 390, 480, `USED: ${usedMem} GB`);
        image.print(font16, 390, 510, `FREE: ${freeMem} GB`);

        drawCard(670, 230, 280, 320, 'STORAGE');
        drawRing(image, 810, 390, 70, 15, 0.64, '#10b981', '#1e293b');
        image.print(font32, 770, 375, '64%');
        image.print(font16, 700, 480, 'USED: 122.9 GB');
        image.print(font16, 700, 510, 'FREE: 69.7 GB');

        image.print(font32, 50, 600, 'STARDOOM STATS');
        drawCard(50, 650, 900, 120, '');
        
        image.print(font16, 120, 675, 'ACTIVE PLUGINS');
        image.print(font32, 150, 705, pluginCount.toString());
        
        image.print(font16, 420, 675, 'RAM ALLOCATION');
        image.print(font32, 440, 705, `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);

        image.print(font16, 730, 675, 'SYSTEM STATUS');
        image.print(font32, 750, 705, 'ONLINE');

        image.print(font32, 50, 810, 'INFORMATION');
        drawCard(50, 850, 900, 310, '');

        const infoItems = [
            { label: 'Hostname', val: os.hostname() },
            { label: 'Platform', val: os.platform() },
            { label: 'Uptime', val: `${Math.floor(process.uptime() / 60)}m` },
            { label: 'Engine', val: 'Node ' + process.version },
            { label: 'RSS Mem', val: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB` },
            { label: 'Heap Total', val: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB` },
            { label: 'Heap Used', val: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB` },
            { label: 'Status', val: 'Stable' }
        ];

        let startX = 90;
        let startY = 880;
        infoItems.forEach((item, index) => {
            let col = index % 4;
            let row = Math.floor(index / 4);
            let x = startX + (col * 210);
            let y = startY + (row * 120);

            image.print(font16, x, y, item.label);
            image.print(font32, x, y + 30, item.val);
        });

        image.print(font16, 50, 1200, `Generated: ${new Date().toLocaleString()}`);

        return await image.getBufferAsync(Jimp.MIME_PNG);

    } catch (e) {
        console.error('[Stats Card Error]:', e);
        return null;
    }
}
