import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import fetch, { RequestInit } from 'node-fetch';


async function fetchData(url: string, options?: RequestInit) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            throw new Error(`HTTP error ${response.status}: ${JSON.stringify(errorData)}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return null;
    }
}

/**
 * 
 * @param playerName 
 * @returns WorldPlayerでは各々のJSONを返すNameを指定した場合はその対象の情報だけを返す
 * 
 */
async function getPlayerData(playerName: string): Promise<any> {
    try {
        const playerData = await fetchData(`http://localhost:5000/api/get/WorldPlayer?playerName=${playerName}`);
        return playerData;
    } catch (error) {
        console.error(`Error getting player data for ${playerName}:`, error);
        return null;
    }
}

async function getData(playerName: string): Promise<any> {
    try {
        const data = await fetchData(`http://localhost:5000/api/get/getData?playerName=${playerName}`);
        return data;
    } catch (error) {
        console.error(`Error getting data for ${playerName}:`, error);
        return null;
    }
}



const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        // index.html を提供
        const filePath = path.join(__dirname, 'index.html');
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        } catch (error) {
            console.error("Error reading index.html:", error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }

    } else if (req.method === 'GET' && req.url === '/playerList') {
        try {
            const playerList = await fetchData('http://localhost:5000/api/get/playerList');
            if (playerList) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(playerList));
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Failed to fetch player list.');
            }

        } catch (error) {
            console.error("Error:", error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }

    } else if (req.method === 'GET' && (req.url?.startsWith('/playerData/'))) {
        try {
            const playerName = req.url.substring('/playerData/'.length);
            const worldPlayerData = await getPlayerData(playerName);
            const getDataData = await getData(playerName);
            if (worldPlayerData && getDataData) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ worldPlayer: worldPlayerData, getData: getDataData }));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Player not found');
            }
        } catch (error) {
            console.error("Error fetching player data:", error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    } else if (req.method === 'GET' && req.url === '/worldMap') {
        try {
            const filePath = path.join(__dirname, 'worldMap.html'); // worldMap.htmlへのパス
            const data = fs.readFileSync(filePath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        } catch (error) {
            console.error("Error reading worldMap.html:", error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    } else if (req.method === 'GET' && req.url === '/onlinePlayerData') {
        try {
            const playerList = await fetchData('http://localhost:5000/api/get/playerList');
            if (!playerList) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Failed to fetch player list.');
                return;
            }

            const onlinePlayersData = await Promise.all(
                playerList.map(async (player: { name: any; }) => {
                    const playerName = player.name;

                    if (!playerName) {  // nameプロパティが存在しない場合のエラー処理
                        console.error("Player name is undefined:", player);
                        return { playerName: "unknown", data: null };
                    }

                    // console.log("Fetching data for:", playerName);

                    const getDataData = await getPlayerData(playerName);
                    return { playerName: playerName, data: getDataData, playerlist: playerList };
                })
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(onlinePlayersData));

        } catch (error) {
            console.error("Error fetching online player data:", error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
});

server.listen(19132, () => {
    console.log('Server listening on port 19132');
});