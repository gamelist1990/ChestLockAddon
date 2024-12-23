import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { networkInterfaces } from 'os';
import WebSocket from 'ws';
const { Server } = WebSocket;
import fetch, { RequestInit } from 'node-fetch';

const HTTP_PORT = 19133; // HTTP サーバー用のポート
const WS_PORT = 19134; // WebSocket サーバー用のポート
const API_BASE_URL = 'http://localhost:5000/api/get'; // Minecraft サーバーの API ベース URL

interface UserPosition {
    username: string;
    position: { x: number; y: number; z: number };
    muted: boolean;
}

let userPositions: UserPosition[] = [];
let wss: WebSocket.Server;

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
    return fetchData(`WorldPlayer?playerName=${playerName}`);
}

async function getPlayerList() {
    return fetchData('playerList');
}

// 距離に応じた音量調整を行う関数（修正）
function getVolumeByDistance(distance: number, maxDistance: number = 30, minVolume: number = 0.01): number {
    if (distance > maxDistance) {
        return minVolume;
    }
    const volume = 1 / (1 + Math.pow(distance, 2)); // 距離の2乗に反比例
    return Math.max(volume, minVolume); // 最小音量を設定
}

// 修正された isNear 関数（距離を返すように変更）
function calculateDistance(user1Pos: { x: number; y: number; z: number }, user2Pos: { x: number; y: number; z: number }): number {
    const distance = Math.sqrt(
        Math.pow(user1Pos.x - user2Pos.x, 2) +
        Math.pow(user1Pos.y - user2Pos.y, 2) +
        Math.pow(user1Pos.z - user2Pos.z, 2)
    );
    return distance;
}


function sendToNearbyUsers(sender: string, position: { x: number; y: number; z: number }, message: any) {
    userPositions.filter(u => u.username !== sender && !u.muted)
        .forEach(u => {
            const distance = calculateDistance(position, u.position);
            const volume = getVolumeByDistance(distance);
            const userSocket = findSocketByUsername(u.username);
            if (userSocket) {
                userSocket.send(JSON.stringify({ ...message, volume })); 
            }
        });
}

function findSocketByUsername(username: string): WebSocket | undefined {
    for (const client of wss.clients) {
        if (client['username'] === username) {
            return client;
        }
    }
    return undefined;
}

function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    console.log(`リクエスト：${method} ${pathname}`);

    if (method === 'GET') {
        if (pathname === '/') {
            sendFile('index_vc.html', res);
        } else {
            sendError(404, 'Not Found', res);
        }
    } else {
        sendError(405, 'Method Not Allowed', res);
    }
}

function sendFile(filename: string, res: http.ServerResponse) {
    try {
        const filePath = path.join(__dirname, filename);
        const data = fs.readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    } catch (err) {
        console.error(`sendFile エラー: ${filename}の読み込みに失敗しました。`, err);
        sendError(500, 'Internal Server Error', res);
    }
}

function sendError(statusCode: number, message: string, res: http.ServerResponse) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: message }));
}

const server = http.createServer(handleHttpRequest);

wss = new WebSocket.Server({ port: WS_PORT }); // WebSocket サーバーを別のポートで起動

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const parsedUrl = url.parse(req.url || '/', true);
    const username = parsedUrl.query.username as string;

    if (!username) {
        ws.close(1008, 'Username is required');
        return;
    }

    ws['username'] = username;
    userPositions.push({ username, position: { x: 0, y: 0, z: 0 }, muted: false });

    console.log(`${username} が接続しました`);

    // 接続中のユーザーリストを送信
    broadcastUserList();

    ws.on('message', async (message: string) => {
        const data = JSON.parse(message);
        if (data.type === 'position') {
            const userPosition = userPositions.find(u => u.username === username);
            if (userPosition) {
                userPosition.position = data.position;
            }
        } else if (data.type === 'voice') {
            // 近接ユーザーに音声データを送信
            const userPosition = userPositions.find(u => u.username === username);
            if (userPosition && !userPosition.muted) {
                sendToNearbyUsers(username, userPosition.position, { type: 'voice', from: username, data: data.data });
            }
        } else if (data.type === 'mute') {
            const user = userPositions.find(u => u.username === username);
            if (user) {
                user.muted = true;
                console.log(`${username} をミュートしました`);
            }
        } else if (data.type === 'unmute') {
            const user = userPositions.find(u => u.username === username);
            if (user) {
                user.muted = false;
                console.log(`${username} のミュートを解除しました`);
            }
        }
    });

    ws.on('close', () => {
        console.log(`${username} が切断しました`);
        userPositions = userPositions.filter(u => u.username !== username);
        // 接続中のユーザーリストを送信
        broadcastUserList();
    });

    ws.on('error', (error) => {
        console.error('WebSocket エラー:', error);
    });
});

function broadcastUserList() {
    const userList = userPositions.map(u => u.username);
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'userList', users: userList }));
    });
}

server.listen(HTTP_PORT, () => {
    console.log(`HTTP Server listening on port ${HTTP_PORT}`);
    console.log(`WebSocket Server listening on port ${WS_PORT}`);
    const ipAddress = getLocalIpAddress();
    if (ipAddress) {
        console.log(`Server IP address: ${ipAddress}:${HTTP_PORT} (HTTP)`);
        console.log(`Server IP address: ${ipAddress}:${WS_PORT} (WebSocket)`);
    } else {
        console.error('Unable to retrieve server IP address.');
    }
});

function getLocalIpAddress(): string | null {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                continue;
            }
            return iface.address;
        }
    }
    return null;
}

// 1秒ごとにプレイヤーの位置情報を取得し、更新する
setInterval(async () => {
    const playerList = await getPlayerList();
    if (playerList) {
        for (const player of playerList) {
            const playerData = await getPlayerData(player.name);
            if (playerData) {
                const userPosition = userPositions.find(u => u.username === player.name);
                if (userPosition) {
                    userPosition.position = {
                        x: playerData.position.x,
                        y: playerData.position.y,
                        z: playerData.position.z,
                    };
                }
            }
        }
    }
}, 1000);