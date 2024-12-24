import * as fs from 'fs';
import http from 'http';
import { Buffer } from 'buffer';

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        // クライアント側のHTMLファイル (audio.html) を提供
        fs.readFile('./audio.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading audio.html');
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/audio' && req.method === 'POST') {
        // クライアントからのPOSTリクエストを処理
        let body: string = '';
        req.on('data', (chunk) => {
            body += chunk.toString(); // リクエストボディを文字列として蓄積
        });
        req.on('end', async () => {
            try {
                // JSON形式のデータをパース
                const jsonBody = JSON.parse(body);
                const base64Audio = jsonBody.audio;

                // Base64データからプレフィックスを除去
                const prefix = /^data:audio\/(webm|ogg|wav);base64,/;
                const base64AudioData = base64Audio.replace(prefix, '');

                // Base64データをBufferにデコード
                const audioData = Buffer.from(base64AudioData, 'base64');

                // 音量調整パラメータ
                const volume = 0.5;

                // 音声データを処理 (音量調整)
                const adjustedAudioData = await processAudio(audioData, volume);

                // 調整後の音声データをBase64エンコード
                const adjustedBase64Audio = adjustedAudioData.toString('base64');

                // クライアントに返すレスポンス (JSON形式)
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ audio: `data:audio/wav;base64,${adjustedBase64Audio}` })); // 適切なMIMEタイプとプレフィックスを付与

            } catch (err) {
                console.error('Error processing audio:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error processing audio');
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

// 音声処理関数 (音量調整)
async function processAudio(audioData: Buffer, volume: number): Promise<Buffer> {
    // サンプルレートとチャンネル数は、仮に48000Hz, 1チャンネルと仮定
    const sampleRate = 48000;
    const channels = 1;

    // クライアントから送信されたデータが生のPCMデータであると仮定
    const pcmData = audioData;

    // ボリューム調整 (入力はInt16Arrayを想定)
    const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / Int16Array.BYTES_PER_ELEMENT);
    const adjustedInt16Array = adjustVolume(int16Array, volume);

    // 調整後のPCMデータをWAVデータに変換
    const wavData = createWavFile(adjustedInt16Array, sampleRate, channels);

    return wavData;
}

// ボリューム調整関数
function adjustVolume(int16Array: Int16Array, volume: number): Int16Array {
    const adjusted = new Int16Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        // ボリューム調整とクリッピング処理
        adjusted[i] = Math.max(-32768, Math.min(32767, Math.round(int16Array[i] * volume)));
    }
    return adjusted;
}

// WAVファイル作成関数 (ただし、ここではBufferを返すだけ)
function createWavFile(audioData: Int16Array, sampleRate: number, numChannels: number): Buffer {
    const dataLength = audioData.length * 2; // 16-bit PCMなので2倍
    const bufferLength = 44 + dataLength;
    const buffer = Buffer.alloc(bufferLength);

    // RIFFヘッダ
    buffer.write('RIFF', 0, 4, 'ascii');
    buffer.writeUInt32LE(bufferLength - 8, 4); // ファイルサイズ - 8
    buffer.write('WAVE', 8, 4, 'ascii');

    // fmtチャンク
    buffer.write('fmt ', 12, 4, 'ascii');
    buffer.writeUInt32LE(16, 16); // fmtチャンクのサイズ
    buffer.writeUInt16LE(1, 20); // PCMフォーマット (1)
    buffer.writeUInt16LE(numChannels, 22); // チャンネル数
    buffer.writeUInt32LE(sampleRate, 24); // サンプルレート
    buffer.writeUInt32LE(sampleRate * numChannels * 2, 28); // バイトレート
    buffer.writeUInt16LE(numChannels * 2, 32); // ブロックアライン
    buffer.writeUInt16LE(16, 34); // ビット深度 (16-bit)

    // dataチャンク
    buffer.write('data', 36, 4, 'ascii');
    buffer.writeUInt32LE(dataLength, 40); // データサイズ

    // PCMデータ書き込み
    for (let i = 0; i < audioData.length; i++) { // ここを修正
        buffer.writeInt16LE(audioData[i], 44 + i * 2);
    }

    return buffer;
}

server.listen(8000, () => {
    console.log('Server listening on port 8000');
});