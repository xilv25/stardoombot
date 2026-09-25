import fs from 'fs';
import path from 'path';

export default function (app) {
    app.get('/api/stream/video', (req, res) => {
        const videoPath = path.resolve('./src/test/video.mp4');

        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'File video src/test/video.mp4 tidak ditemukan.' });
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
            });
            fileStream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            });
            fs.createReadStream(videoPath).pipe(res);
        }
    });
}