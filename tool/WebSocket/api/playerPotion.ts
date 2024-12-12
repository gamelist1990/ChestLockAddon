import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import fetch, { RequestInit } from 'node-fetch';
import * as url from 'url';
import * as bcrypt from 'bcrypt';

const PORT = 19132;
const API_BASE_URL = 'http://localhost:5000/api/get';
const USERS_FILE = 'tool/WebSocket/api/users.json';
const SALT_ROUNDS = 10;

interface ShopItem {
    name: string;
    price: number;
    quantity: number;
}

interface ShopData {
    items: ShopItem[];
    balance: number;
}

interface User {
    username: string;
    password: string;
    shop?: ShopData;
}

let users: User[] = [];

function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(data);
        console.log("users.jsonを読み込みました:", users);
    } catch (err) {
        console.error("users.jsonの読み込みエラー、またはファイルが存在しません。", err);
        users = [];
    }
}

function saveUsers() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log("users.jsonにデータを保存しました。");
    } catch (err) {
        console.error("users.jsonへの保存エラー:", err);
    }
}

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

async function getOtherData(playerName: string, dataType: 'getData' | any) {
    return fetchData(`${dataType}?playerName=${playerName}`);
}


async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    console.log(`リクエスト：${method} ${pathname}`);

    try {
        if (method === 'GET') {
            if (pathname === '/') {
                sendFile('index.html', res);
            } else if (pathname === '/playerList') {
                const playerList = await fetchData('playerList');
                sendJSON(playerList, res);
            } else if (pathname === '/onlinePlayerData') {
                const playerList = await fetchData('playerList') || [];
                const onlinePlayersData = await Promise.all(
                    playerList.map(async (player: { name: string }) => {
                        const playerName = player.name;
                        if (!playerName) {
                            console.error("Player name is undefined:", player);
                            return { playerName: "unknown", data: null };
                        }
                        const playerData = await getPlayerData(playerName);
                        return { playerName, data: playerData };
                    })
                );
                sendJSON(onlinePlayersData, res);
            } else if (pathname?.startsWith('/playerData/')) {
                const playerName = pathname.substring('/playerData/'.length);
                const worldPlayerData = await getPlayerData(playerName);
                const getDataData = await getOtherData(playerName, 'getData');
                if (worldPlayerData && getDataData) {
                    sendJSON({ worldPlayer: worldPlayerData, getData: getDataData }, res);
                } else {
                    sendError(404, 'Player not found', res);
                }
            } else if (pathname === '/worldMap') {
                sendFile('worldMap.html', res);
            } else if (pathname === '/shopData') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);

                        if (user) {
                            const passwordMatch = await bcrypt.compare(password, user.password);
                            if (passwordMatch) {
                                if (user.shop) {
                                    sendJSON({ shopData: user.shop }, res);
                                } else {
                                    sendJSON({ message: "ショップはまだ開設されていません。" }, res);
                                }
                            } else {
                                sendError(401, 'パスワードが違います', res);
                            }
                        } else {
                            sendError(401, 'ユーザーが存在しません', res);
                        }
                    } catch (error) {
                        console.error("ショップデータ取得エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });
            } else if (pathname === '/shops') {
                sendFile('shops.html', res);
            } else {
                sendError(404, 'Not Found', res);
            }
        } else if (method === 'POST') {
            if (pathname === '/register') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { username, password } = JSON.parse(body);

                        if (users.find(u => u.username === username)) {
                            sendError(400, 'ユーザー名はすでに使われています', res);
                            return;
                        }

                        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
                        const newUser: User = { username, password: hashedPassword };
                        users.push(newUser);
                        saveUsers();
                        sendJSON({ message: '登録成功', user: newUser }, res);
                    } catch (error) {
                        console.error("登録処理エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });
            } else if (pathname === '/login') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);

                        if (user) {
                            const passwordMatch = await bcrypt.compare(password, user.password);
                            if (passwordMatch) {
                                sendJSON({ message: 'ログイン成功', user }, res);
                            } else {
                                sendError(401, 'ログイン失敗: パスワードが違います', res);
                            }
                        } else {
                            sendError(401, 'ログイン失敗: ユーザーが存在しません', res);
                        }
                    } catch (error) {
                        console.error("ログイン処理エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });
            } else if (pathname === '/createShop') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);

                        if (user) {
                            const passwordMatch = await bcrypt.compare(password, user.password);
                            if (passwordMatch) {
                                if (!user.shop) {
                                    user.shop = { items: [], balance: 0 };
                                    saveUsers();
                                    sendJSON({ message: 'ショップ開設成功', user }, res);
                                } else {
                                    sendJSON({ message: 'すでにショップを開設済みです', user }, res);
                                }
                            } else {
                                sendError(401, '認証エラー: パスワードが違います', res);
                                return;
                            }
                        } else {
                            sendError(401, '認証エラー', res);
                        }
                    } catch (error) {
                        console.error("ショップ開設エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });
            } else if (pathname === '/buy') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { itemName, username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);

                        if (user && user.shop) {
                            const passwordMatch = await bcrypt.compare(password, user.password);

                            if (passwordMatch) {
                                const item = user.shop.items.find(i => i.name === itemName);

                                if (!item) {
                                    sendError(404, '商品が見つかりません。', res);
                                    return;
                                }

                                if (item.quantity <= 0) {
                                    sendError(400, '在庫切れです。', res);
                                    return;
                                }

                                item.quantity--;
                                user.shop.balance += item.price;
                                saveUsers();

                                sendJSON({ message: `${itemName} を購入しました。`, shopData: user.shop }, res);
                            } else {
                                sendError(401, 'パスワードが違います', res);
                                return;
                            }
                        } else {
                            sendError(401, '認証エラー、またはショップが存在しません', res);
                        }
                    } catch (error) {
                        console.error("購入処理エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });
            } else if (pathname === '/addItem') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { itemName, price, quantity, username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);


                        if (user && user.shop) {
                            const passwordMatch = await bcrypt.compare(password, user.password);
                            if (!passwordMatch) {
                                sendError(401, 'パスワードが違います', res);
                                return;
                            }


                            const newItem: ShopItem = {
                                name: itemName,
                                price: price,
                                quantity: quantity
                            };


                            user.shop.items.push(newItem);
                            saveUsers();


                            sendJSON({ message: `${itemName} を追加しました。`, shopData: user.shop }, res);
                        } else {
                            sendError(401, '認証エラー、またはショップが存在しません', res);
                        }
                    } catch (error) {
                        console.error("商品追加エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });


            } else if (pathname === '/otherShops') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);

                        if (user) {
                            const passwordMatch = await bcrypt.compare(password, user.password);
                            if (passwordMatch) {

                                const otherShops = users.filter(user => user.shop && user.username !== username);
                                const shopData = otherShops.map(user => ({ username: user.username, items: user.shop?.items || [] }));
                                sendJSON({ shops: shopData }, res);
                            } else {
                                sendError(401, 'パスワードが違います', res);
                            }
                        } else {
                            sendError(401, 'ユーザーが存在しません', res);
                        }
                    } catch (error) {
                        console.error("他のショップ取得エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });

            } else if (pathname === '/editItem') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { itemName, price, quantity, username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);

                        if (user && user.shop) {
                            const passwordMatch = await bcrypt.compare(password, user.password);
                            if (!passwordMatch) {
                                sendError(401, 'パスワードが違います', res);
                                return;
                            }

                            const item = user.shop.items.find(i => i.name === itemName);
                            if (!item) {
                                sendError(404, '商品が見つかりません', res);
                                return;
                            }

                            item.price = price;
                            item.quantity = quantity;
                            saveUsers();
                            sendJSON({ message: `${itemName} の情報を更新しました。`, shopData: user.shop }, res);
                        } else {
                            sendError(401, '認証エラー、またはショップが存在しません', res);
                        }
                    } catch (error) {
                        console.error("商品情報更新エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });
            } else if (pathname === '/deleteItem') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { itemName, username, password } = JSON.parse(body);
                        const user = users.find(u => u.username === username);

                        if (user && user.shop) {
                            const passwordMatch = await bcrypt.compare(password, user.password);
                            if (!passwordMatch) {
                                sendError(401, 'パスワードが違います', res);
                                return;
                            }

                            const itemIndex = user.shop.items.findIndex(i => i.name === itemName);
                            if (itemIndex === -1) {
                                sendError(404, '商品が見つかりません', res);
                                return;
                            }

                            user.shop.items.splice(itemIndex, 1);
                            saveUsers();
                            sendJSON({ message: `${itemName} を削除しました。`, shopData: user.shop }, res);

                        } else {
                            sendError(401, '認証エラー、またはショップが存在しません', res);
                        }
                    } catch (error) {
                        console.error("商品削除エラー:", error);
                        sendError(500, 'Internal Server Error', res);
                    }
                });
            } else {
                sendError(404, 'Not Found', res);
            }
        } else {
            sendError(405, 'Method Not Allowed', res);
        }
    } catch (error) {
        console.error("リクエスト処理エラー:", error);
        sendError(500, 'Internal Server Error', res);
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

function sendJSON(data: any, res: http.ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendError(statusCode: number, message: string, res: http.ServerResponse) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(message);
}

loadUsers();



const server = http.createServer(handleRequest);


server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});