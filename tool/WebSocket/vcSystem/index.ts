import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { networkInterfaces } from 'os';
import WebSocket from 'ws';
const { Server } = WebSocket;
import fetch, { RequestInit } from 'node-fetch';

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

function getVolumeByDistance(distance, maxDistance = 30, minVolume = 0.01) {
    if (distance > maxDistance) {
        return minVolume;
    }
    const volume = 1 / (1 + Math.pow(distance, 2));
    return Math.max(volume, minVolume);
}

function calculateDistance(user1Pos, user2Pos) {
    return Math.sqrt(
        Math.pow(user1Pos.x - user2Pos.x, 2) +
        Math.pow(user1Pos.y - user2Pos.y, 2) +
        Math.pow(user1Pos.z - user2Pos.z, 2)
    );
}

function getNearbyUsers(currentUser) {
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

function handleHttpRequest(req, res) {
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

async function sendPlayerList(res) {
    try {
        const playerList = await getPlayerList();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ players: playerList }));
    } catch (error) {
        console.error('プレイヤーリストの取得に失敗しました:', error);
        sendError(500, 'Internal Server Error', res);
    }
}

function sendFile(filename, res) {
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

function sendError(statusCode, message, res) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: message }));
}

const server = http.createServer(handleHttpRequest);

wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', async (ws, req) => {
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

    ws.on('message', async (message) => {
        if (message instanceof Buffer) {
            handlePcmAudio(username, message);
        } else {
            try {
                const data = JSON.parse(message.toString());
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

function handlePcmAudio(username, pcmData) {
    const userPosition = userPositions.find(u => u.username === username)?.position;

    if (userPosition) {
        broadcastPcmAudio(username, userPosition, pcmData);
    } else {
        console.warn(`Could not find position for user: ${username}`);
    }
}

function broadcastPcmAudio(sender, position, pcmData) {
    console.log("Sending PCM audio data:", pcmData.length, "bytes");

    userPositions.forEach(u => {
        if (u.username !== sender) {
            const distance = calculateDistance(position, u.position);
            const volume = getVolumeByDistance(distance);
            const userSocket = findSocketByUsername(u.username);

            if (userSocket) {
                userSocket.send(pcmData, { binary: true }, (err) => {
                    if (err) {
                        console.error("Failed to send voice data:", err);
                    }
                });
            } else {
                console.warn("Could not find socket for user:", u.username);
            }
        }
    });
}

function findSocketByUsername(username) {
    for (const client of wss.clients) {
        if (client['username'] === username) {
            return client;
        }
    }
    return undefined;
}


function getLocalIpAddress() {
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
        if (Array.isArray(playerDataArray) && playerDataArray.length > 0 && playerDataArray[0].position) {
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