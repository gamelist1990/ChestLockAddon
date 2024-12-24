import * as fs from 'fs';
import * as http from 'http';
import { Buffer } from 'buffer';

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile('./audio.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading audio.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/audio' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            try {
                const audioData = Buffer.concat(chunks);
                const adjustedPcm = adjustVolume(audioData, 0.5);

                res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                res.end(adjustedPcm);
            } catch (err) {
                console.error('Error processing audio:', err);
                res.writeHead(500);
                res.end('Error processing audio');
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

function adjustVolume(pcmData: Buffer, volume: number): Buffer {
    if (!Buffer.isBuffer(pcmData)) {
        throw new Error("Invalid input: pcmData must be a Buffer");
    }
    if (pcmData.length % 2 !== 0) {
        console.warn("PCM data length is not a multiple of 2. Truncating.");
        pcmData = pcmData.slice(0, -(pcmData.length % 2));
    }

    const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
    for (let i = 0; i < int16Array.length; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, Math.round(int16Array[i] * volume)));
    }
    return Buffer.from(int16Array.buffer);
}

server.listen(8000, () => {
    console.log('Server listening on port 8000');
});