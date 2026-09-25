import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 2096;

// Middleware Global untuk Mengizinkan CORS (Wajib agar video bisa diputar di AIRich WhatsApp)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

app.use(express.json());

// ==========================================
// 1. ENDPOINT STREAMING VIDEO (Untuk AIRich Player)
// ==========================================
app.get('/api/stream/video', (req, res) => {
    const videoPath = path.resolve('./src/test/video.mp4');

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'File video src/test/video.mp4 tidak ditemukan di server.' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
            res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
            return res.send();
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(videoPath, { start, end });
        
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
            'Access-Control-Allow-Origin': '*'
        });
        fileStream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(videoPath).pipe(res);
    }
});

// ==========================================
// 2. ENDPOINT LAIN (Contoh: Tetris Score Save yang sebelumnya)
// ==========================================
app.post('/api/tetris/save', (req, res) => {
    // Logika penyimpanan skor tetris kamu di sini
    res.json({ status: 'success', message: 'Skor berhasil disimpan!' });
});

// Jalankan Server Express di Port 2096
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Express Server berjalan di port ${PORT}`);
    console.log(`🎥 Video Stream URL: http://45.134.39.55:${PORT}/api/stream/video`);
});
