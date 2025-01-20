import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

// 現在の実行ファイルのディレクトリを取得
const CURRENT_DIR = path.dirname(process.execPath);

// 実行ファイル名
const EXE_NAME = "localtonet.exe";

// 各ファイルのパスを現在のディレクトリに設定
const EXE_PATH = path.join(CURRENT_DIR, EXE_NAME);
const JSON_PATH = path.join(CURRENT_DIR, 'connection_info.json');
const CONFIG_YAML_PATH = path.join(CURRENT_DIR, 'config.yml'); // config.yml のパスを追加

interface ConnectionInfo {
    ip: string | null;
    port: number;
}

function saveConnectionInfoToJSON(ip: string | null, port: number) {
    const connectionInfo: ConnectionInfo = { ip, port };
    fs.writeFileSync(JSON_PATH, JSON.stringify(connectionInfo, null, 2));
    console.log(`Connection info (IP: ${ip}, Port: ${port}) saved to ${JSON_PATH}`);
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

function updateConfigYaml(ip: string, port: number) {
    try {
        if (fs.existsSync(CONFIG_YAML_PATH)) {
            const config = yaml.load(fs.readFileSync(CONFIG_YAML_PATH, 'utf-8')) as any;

            // session.session-info の ip と port を更新
            if (config.session && config.session["session-info"]) {
                config.session["session-info"].ip = ip;
                config.session["session-info"].port = port;
            }

            fs.writeFileSync(CONFIG_YAML_PATH, yaml.dump(config));
            console.log(`Updated session-info in ${CONFIG_YAML_PATH} to IP: ${ip}, Port: ${port}`);
        } else {
            console.log(`${CONFIG_YAML_PATH} not found. Skipping update.`);
        }
    } catch (error) {
        console.error('Error updating config.yml:', error);
    }
}

// EXE の存在確認
if (!fs.existsSync(EXE_PATH)) {
    console.error(`Error: ${EXE_NAME} not found at ${EXE_PATH}`);
    process.exit(1);
}

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
                saveConnectionInfoToJSON(connectionInfo.ip, connectionInfo.port);

                // config.yml の session.session-info を更新
                if (connectionInfo.ip !== null) {
                    updateConfigYaml(connectionInfo.ip, connectionInfo.port);
                }
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