import fetch, { RequestInit } from 'node-fetch';
import Server from 'socket-be/typings/Server';

// 非同期処理を待つためのヘルパー関数
async function fetchData(url: string, options?: RequestInit) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response.' })); // エラーレスポンスのパースに失敗した場合の処理を追加
            throw new Error(`HTTP error ${response.status}: ${JSON.stringify(errorData)}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return null;
    }
}


//// playerList関数
fetchData('http://localhost:5000/api/get/playerList')
    .then(data => console.log("playerList result:", data));

////isAdmin関数(引数あり)
fetchData('http://localhost:5000/api/get/isAdmin?player=PEXkurann')
    .then(data => console.log("isAdmin result:", data));


//// データ登録
//fetchData('http://localhost:5000/api/register', {
//    method: 'POST',
//    headers: { 'Content-Type': 'application/json' },
//    body: JSON.stringify({ name: 'testPlugin', data: { message: 'Test data', value: 123 } })
//})
//    .then(result => console.log("register result:", result));
//
//
// 登録したデータの取得
//fetchData('http://localhost:5000/api/get/testPlugin')
//    .then(data => console.log("testPlugin data:", data));





function sendMessageToFirstWorld(server: Server) {
    const world = server.getWorlds()[0];
    if (world) {
        world.sendMessage("test");
        return "Message sent successfully!"; 
    } else {
        console.error("World not found!");
        return "World not found!"; 
    }
}

async function test() {
    const functionName = 'test1'; 
    const code = String(sendMessageToFirstWorld);

    const result = await fetchData('http://localhost:5000/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, functionName }) 
    });

    console.log("Execution result:", result);
}

