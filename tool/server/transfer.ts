import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

const EXE_PATH = "C:/Users/PC_User/Documents/PVPClient/localtonet.exe";

// 現在のファイルのディレクトリを取得
const CURRENT_DIR = path.dirname(__filename);
const JSON_PATH = path.join(CURRENT_DIR, 'connection_info.json');
const LISTEN_PORT = 19132;

interface ConnectionInfo {
    ip: string | null;
    port: number;
    destination_ip?: string; // 追加: 転送先IPアドレス
    destination_port?: number; // 追加: 転送先ポート番号
}

function readConnectionInfoFromJSON(): ConnectionInfo | null {
    try {
        const data = fs.readFileSync(JSON_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading or parsing JSON file:', error);
        return null;
    }
}

function extractConnectionInfo(output: string): ConnectionInfo | null {
    const match = output.match(/([a-zA-Z0-9.-]+)\.localto\.net:(\d+)/);
    if (match) {
        return {
            ip: match[1] + ".localto.net",
            port: parseInt(match[2]),
        };
    }
    return null;
}

// localtonet.exe を起動して接続情報を取得
const child = spawn(EXE_PATH);

child.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`stdout: ${output}`);
    const connectionInfo = extractConnectionInfo(output);
    if (connectionInfo) {
        try {
            let existingConnectionInfo: ConnectionInfo = { ip: null, port: 0 };
            try {
                existingConnectionInfo = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
            } catch (e) {
                console.log("JSON file not found, creating new one.");
            }

            if (existingConnectionInfo.ip !== connectionInfo.ip || existingConnectionInfo.port !== connectionInfo.port) {
                // 既存の情報を維持しつつ、新しい情報で更新
                const updatedConnectionInfo = {
                    ...existingConnectionInfo,
                    ip: connectionInfo.ip,
                    port: connectionInfo.port
                };
                fs.writeFileSync(JSON_PATH, JSON.stringify(updatedConnectionInfo, null, 2));
                console.log(`Connection info (IP: ${connectionInfo.ip}, Port: ${connectionInfo.port}) saved to ${JSON_PATH}`);
            } else {
                console.log(`Connection info (IP: ${connectionInfo.ip}, Port: ${connectionInfo.port}) is already saved in ${JSON_PATH}`);
            }
        } catch (error) {
            console.error('Error writing to JSON file:', error);
        }
    }
});

child.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
});

// TCP サーバーを起動
const server = net.createServer((clientSocket) => {
    console.log(`Client connected: ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

    const connectionInfo = readConnectionInfoFromJSON();
    if (connectionInfo && connectionInfo.destination_ip && connectionInfo.destination_port) {
        console.log(`Forwarding to ${connectionInfo.destination_ip}:${connectionInfo.destination_port}`);

        const targetSocket = net.createConnection(
            { host: connectionInfo.destination_ip, port: connectionInfo.destination_port },
            () => {
                console.log(`Connected to target: ${connectionInfo.destination_ip}:${connectionInfo.destination_port}`);

                // データの転送
                clientSocket.pipe(targetSocket);
                targetSocket.pipe(clientSocket);
            }
        );

        targetSocket.on('end', () => {
            console.log("Target disconnected.");
            clientSocket.end();
        });

        targetSocket.on('error', (err) => {
            console.error(`Target connection error: ${err}`);
            clientSocket.end(); // クライアント側の接続も閉じる
        });
    } else {
        console.error('Destination IP and port not found or incomplete. Cannot forward.');
        clientSocket.end(); // 接続情報を取得できなかったらクライアント側の接続を閉じる
    }

    clientSocket.on('end', () => {
        console.log(`Client disconnected: ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);
    });

    clientSocket.on('error', (err) => {
        console.error(`Client connection error: ${err}`);
    });
});

server.listen(LISTEN_PORT, () => {
    console.log(`TCP server listening on port ${LISTEN_PORT}`);
});