import fetch, { RequestInit } from 'node-fetch';

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


// playerList関数
fetchData('http://localhost:5000/api/get/playerList')
    .then(data => console.log("playerList result:", data));

//isAdmin関数(引数あり)
fetchData('http://localhost:5000/api/get/isAdmin?player=PEXkurann')
    .then(data => console.log("isAdmin result:", data));


// データ登録
fetchData('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'testPlugin', data: { message: 'Test data', value: 123 } })
})
    .then(result => console.log("register result:", result));


// 登録したデータの取得
fetchData('http://localhost:5000/api/get/testPlugin')
    .then(data => console.log("testPlugin data:", data));


// server定義の取得
fetchData('http://localhost:5000/api/get/server')
    .then(serverData => {  
        if (serverData) { 
            test(serverData);
        } else {
            console.error("Failed to fetch server definition.");
        }
    });


function test(serverData: any) { // serverData を引数として受け取る
    if (serverData.hasOwnProperty('getWorlds')) { // getWorldsメソッドが存在することを確認
        const world = serverData.getWorlds()[0]; // serverData から getWorlds() を呼び出す
        if (world) {
           world.sendMEssage("Hello Back End API")
        } else {
            console.error("World not found.");
        }
    } else {
        console.error("Server object does not have getWorlds() method.");
    }
}