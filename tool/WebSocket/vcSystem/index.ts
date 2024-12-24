import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { networkInterfaces } from 'os';
import WebSocket from 'ws';
const { Server } = WebSocket;
import fetch, { RequestInit } from 'node-fetch';
import { Encoder, Decoder } from '@evan/opus'; // Opus エンコード/デコード

const HTTP_PORT = 19133;
const WS_PORT = 19134;
const API_BASE_URL = 'http://localhost:5000/api/get';

interface UserPosition {
    username: string;
    position: { x: number; y: number; z: number };
}

interface UserInfo {
    username: string;
    distance: number;
}

let userPositions: UserPosition[] = [];
let wss: WebSocket.Server;
let cachedPlayerList: string[] = [];

async function fetchData(endpoint: string, options?: RequestInit) {
    const url = `${API_BASE_URL}/${endpoint}`;
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            throw new Error(`HTTP error ${response.status} fetching ${url}: ${JSON.stringify(errorData)}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return null;
    }
}

async function getPlayerData(playerName: string) {
    const data = await fetchData(`WorldPlayer?playerName=${playerName}`);
    return data;
}

async function getPlayerList() {
    const playerList = await fetchData('playerList');
    if (playerList) {
        cachedPlayerList = playerList.map((player) => player.name);
    }
    return cachedPlayerList;
}

function getVolumeByDistance(distance: number, maxDistance: number = 30, minVolume: number = 0.01): number {
    if (distance > maxDistance) {
        return minVolume;
    }
    const volume = 1 / (1 + Math.pow(distance, 2));
    return Math.max(volume, minVolume);
}

function calculateDistance(user1Pos: { x: number; y: number; z: number; }, user2Pos: { x: number; y: number; z: number; }): number {
    return Math.sqrt(
        Math.pow(user1Pos.x - user2Pos.x, 2) +
        Math.pow(user1Pos.y - user2Pos.y, 2) +
        Math.pow(user1Pos.z - user2Pos.z, 2)
    );
}

function getNearbyUsers(currentUser: string): UserInfo[] {
    const currentUserPosition = userPositions.find(u => u.username === currentUser)?.position;
    if (!currentUserPosition) return [];

    return userPositions
        .filter(u => u.username !== currentUser)
        .map(u => ({
            username: u.username,
            distance: calculateDistance(currentUserPosition, u.position)
        }))
        .filter(u => u.distance <= 30);
}

function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    if (method === 'GET') {
        if (pathname === '/') {
            sendFile('index.html', res);
        } else if (pathname === '/playerList') {
            sendPlayerList(res);
        } else {
            sendError(404, 'Not Found', res);
        }
    } else {
        sendError(404, 'Not Found', res);
    }
}

async function sendPlayerList(res: http.ServerResponse) {
    try {
        const playerList = await getPlayerList();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ players: playerList }));
    } catch (error) {
        console.error('プレイヤーリストの取得に失敗しました:', error);
        sendError(500, 'Internal Server Error', res);
    }
}

function sendFile(filename: string, res: http.ServerResponse) {
    const filePath = path.join(__dirname, filename);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            sendError(500, 'Internal Server Error', res);
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        }
    });
}

function sendError(statusCode: number, message: string, res: http.ServerResponse) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: message }));
}

const server = http.createServer(handleHttpRequest);

wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
    const parsedUrl = url.parse(req.url || '/', true);
    const username = Array.isArray(parsedUrl.query.username) ? parsedUrl.query.username[0] : parsedUrl.query.username;

    if (!username) {
        ws.close(1008, 'Username is required');
        return;
    }

    ws['username'] = username;
    userPositions.push({ username, position: { x: 0, y: 0, z: 0 } });

    console.log(`${username} が接続しました`);

    ws.send(JSON.stringify({ type: 'playerList', players: cachedPlayerList }));

    broadcastUserList();

    ws.on('message', async (message: WebSocket.Data) => {
        if (typeof message === 'string') {
            try {
                const data = JSON.parse(message);
                if (data.type === 'setPosition') {
                    const position = data.position;
                    if (position && typeof position.x === 'number' && typeof position.y === 'number' && typeof position.z === 'number') {
                        const userIndex = userPositions.findIndex(u => u.username === username);
                        if (userIndex !== -1) {
                            userPositions[userIndex].position = position;
                            broadcastUserList();
                        }
                    } else {
                        console.warn(`Invalid position data received from ${username}:`, position);
                    }
                }
            } catch (error) {
                console.error("Failed to parse message:", error);
            }
        } else if (message instanceof ArrayBuffer || Buffer.isBuffer(message)) {
            handleOpusAudio(username, message);
        } else {
            console.warn(`Unsupported message type received from ${username}:`, typeof message);
        }
    });

    ws.on('close', () => {
        console.log(`${username} が切断しました`);
        userPositions = userPositions.filter(u => u.username !== username);
        broadcastUserList();
    });

    ws.on('error', (error) => {
        console.error('WebSocket エラー:', error);
    });
});

function broadcastUserList() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            const nearbyUsers = getNearbyUsers(client['username']);
            client.send(JSON.stringify({ type: 'userList', users: nearbyUsers }));
        }
    });
}

function handleOpusAudio(username: string, opusData: Buffer | ArrayBuffer) {
    const userPosition = userPositions.find(u => u.username === username)?.position;

    if (userPosition) {
        broadcastOpusAudio(username, userPosition, Buffer.from(opusData));
    } else {
        console.warn(`Could not find position for user: ${username}`);
    }
}

function broadcastOpusAudio(sender: string, position: { x: number; y: number; z: number }, opusData: Buffer) {
    console.log("Received OPUS audio data from:", sender, "bytes:", opusData.length);
    const encoder = new Encoder({
        sample_rate: 48000,
        channels: 1,
        application: 'restricted_lowdelay' as any,
    });

    const decoder = new Decoder({
        sample_rate: 48000,
        channels: 1,
    });
    const nearbyUsers = getNearbyUsers(sender);

    nearbyUsers.forEach(user => {
        const userSocket = findSocketByUsername(user.username);
        if (userSocket) {
            const userPosition = userPositions.find(u => u.username === user.username)?.position;
            if (!userPosition) {
                console.warn(`Could not find position for user: ${user.username}`);
                return; // ユーザーの位置情報が見つからない場合は処理をスキップ
            }
            const distance = calculateDistance(position, userPosition);
            const volume = distance > 30 ? 0.01 : getVolumeByDistance(distance);

            // Opusデータをデコード
            const pcmData = decoder.decode(opusData);

            // ボリューム調整
            const adjustedPcmData = adjustVolume(Buffer.from(pcmData), volume);

            // 再度Opusデータにエンコード
            const adjustedOpusData = encoder.encode(adjustedPcmData);

            userSocket.send(adjustedOpusData, { binary: true }, (err) => {
                if (err) {
                    console.error("Failed to send voice data to", user.username, ":", err);
                } else {
                    console.log("Sent adjusted OPUS audio data to:", user.username, "bytes:", adjustedOpusData.length);
                }
            });
        } else {
            console.warn("Could not find socket for user:", user.username);
        }
    });
}

// 音量調整関数 (PCMデータに対して動作)
function adjustVolume(pcmData: Buffer, volume: number): Buffer {
    if (volume === 1) return pcmData;
    const adjustedPcmData = Buffer.alloc(pcmData.length);
    for (let i = 0; i < pcmData.length; i += 2) {
        let sample = pcmData.readInt16LE(i);
        sample = Math.round(sample * volume);
        // クリッピング処理
        sample = Math.max(-32768, Math.min(32767, sample));
        adjustedPcmData.writeInt16LE(sample, i);
    }
    return adjustedPcmData;
}

function findSocketByUsername(username: string): WebSocket | undefined {
    for (const client of wss.clients) {
        if (client['username'] === username) {
            return client;
        }
    }
    return undefined;
}

function getLocalIpAddress(): string | null {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            // Find an IPv4 address that is not internal
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return null;
}

server.listen(HTTP_PORT, () => {
    console.log(`HTTP Server listening on port ${HTTP_PORT}`);
    console.log(`WebSocket Server listening on port ${WS_PORT}`);

    const ipAddress = getLocalIpAddress();

    if (ipAddress) {
        console.log(`Server IP Address: ${ipAddress}:${HTTP_PORT} (HTTP)`);
        console.log(`Server IP Address: ${ipAddress}:${WS_PORT} (WebSocket)`);
    } else {
        console.error("Unable to retrieve server IP address.");
    }
});

setInterval(async () => {
    await getPlayerList();
    broadcastUserList();
}, 5000);

setInterval(async () => {
    for (const userPosition of userPositions) {
        const playerDataArray = await getPlayerData(userPosition.username);
        if (Array.isArray(playerDataArray) && playerDataArray.length > 0 && playerDataArray[0]?.position) {
            const playerData = playerDataArray[0];
            userPosition.position = {
                x: playerData.position.x,
                y: playerData.position.y,
                z: playerData.position.z
            };
        } else {
            console.warn(`Invalid player data for ${userPosition.username}:`, playerDataArray);
        }
    }

    broadcastUserList();
}, 1000);