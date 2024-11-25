import config from './config.js'
import fs from 'fs/promises';


let lastCopiedTime = 0;



if (!config.path || !config.copyToPath) {
    console.error("config.jsにpathとcopyToPathを設定してください。");
    process.exit(1);
}


async function copyAndReplace(source, destination) {
    try {
        const sourceStats = await fs.stat(source);
        const destStats = (await fs.access(destination).then(() => true, () => false)) ? await fs.stat(destination) : null;

        if (sourceStats.mtimeMs > lastCopiedTime && (!destStats || sourceStats.mtimeMs > destStats.mtimeMs)) {
            if (sourceStats.isDirectory()) {
                await fs.cp(source, destination, { recursive: true });
                await fs.rm(source, { recursive: true, force: true });
                console.log(`${source} (ディレクトリ) を ${destination} へコピーし、削除しました。`);
            } else {
                await fs.copyFile(source, destination);
                await fs.unlink(source);
                console.log(`${source} (ファイル) を ${destination} へコピーし、削除しました。`);
            }

            lastCopiedTime = Date.now();

        } else {
            console.log("変更なし。処理をスキップします。");
        }

    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`エラー: ${error}`);
        }
    }
}

let intervalId = setInterval(async () => {
    await copyAndReplace(config.path, config.copyToPath);
}, 1000);


process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log("コピーを停止しました。");
    process.exit();
});