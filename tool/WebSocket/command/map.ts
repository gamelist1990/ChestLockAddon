import {
    registerCommand,
    MINECRAFT_COMMAND_PREFIX,
} from '../index';
import fetch from 'node-fetch';
import sharp from 'sharp';

// デバッグモードのフラグ (true でデバッグモード有効)
const debugMode = false;

// 同時に処理する列数
const NUM_COLUMNS = 48;

// 遅延時間
const DELAY_TIME = 0;

// 最大同時実行数(負荷率を考え2ぐらい)
const MAX_CONCURRENT_EXECUTIONS = 2;

// 実行中のタスクを追跡するマップ
const runningTasks = new Map<string, boolean>();

const CreatorTag = "creator";

registerCommand('map', `${MINECRAFT_COMMAND_PREFIX}map <x> <y> <z> <url> [tool:<0~3>] `, `指定したURLの画像をMinecraftの地図として生成します(${CreatorTag})`, true, async (sender, world, args) => {
    const playerName = sender;
 

    // 同時実行数のチェック
    if (runningTasks.size >= MAX_CONCURRENT_EXECUTIONS) {
        world.sendMessage(`現在、他のプレイヤーが地図を生成中です。しばらく待ってから再度実行してください。`, sender);
        return;
    }

    if (runningTasks.has(playerName)) {
        world.sendMessage(`あなたは既に地図を生成中です。完了するまで待ってから再度実行してください。`, sender);
        return;
    }

    // タスクの開始を記録
    runningTasks.set(playerName, true);

    try {
        // 座標
        const originalX = parseInt(args[0]);
        const originalY = parseInt(args[1]);
        const originalZ = parseInt(args[2]);
        const imageUrl = args[3];
        const toolArg = args[4]; // tool パラメータ

        if (isNaN(originalX) || isNaN(originalY) || isNaN(originalZ)) {
            world.sendMessage("座標は数値を指定してください。", sender);
            runningTasks.delete(playerName);
            return;
        }

        if (!imageUrl) {
            world.sendMessage("画像のURLを指定してください。", sender);
            runningTasks.delete(playerName);
            return;
        }

        if (!toolArg) {
            world.sendMessage("Toolを指定してください\n普通なら:0\n油絵:1\n 水彩画風:2\n高画質化:3", sender);
            runningTasks.delete(playerName);
            return;
        }


        // 座標を修正 (必要な場合)
        let startX = originalX;
        let startZ = originalZ;

       

        const startY = originalY;

        // tool パラメータの解析
        let toolId = 0; // デフォルトは 0 (最近傍法)
        if (toolArg && toolArg.startsWith('tool:')) {
            const parsedToolId = parseInt(toolArg.substring(5));
            if (!isNaN(parsedToolId)) {
                toolId = parsedToolId;
            }
        }

        try {
            if (debugMode) {
                console.log(`[デバッグ] 地図生成開始: プレイヤー=${playerName}, 座標=(${startX}, ${startY}, ${startZ}), URL=${imageUrl}, ツール=${toolId}`);
            }

            const response = await fetch(imageUrl);

            if (!response.ok) {
                world.sendMessage(`画像の取得に失敗しました。(HTTPエラー: ${response.status})`, sender);
                if (debugMode) {
                    console.error(`[デバッグ] 画像取得エラー: ステータスコード=${response.status}, URL=${imageUrl}`);
                }
                return;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                world.sendMessage("指定されたURLは画像ではありません。", sender);
                if (debugMode) {
                    console.error(`[デバッグ] 画像形式エラー: Content-Type=${contentType}, URL=${imageUrl}`);
                }
                return;
            }

            const imageBuffer = await response.buffer();
            let image = sharp(imageBuffer);

            // 画像を正方形に整形（128x128にリサイズ）
            const size = 128;

            // toolId: 3 の場合、アップスケーリング風の処理 (劣化なしで128x128にリサイズし、さらに高画質化処理を行う)
            if (toolId === 3) {
                const originalMetadata = await image.metadata();
                const originalWidth = originalMetadata.width || size;
                const originalHeight = originalMetadata.height || size;

                // 元の画像が128x128より小さい場合は、Lanczos法で拡大
                if (originalWidth < size || originalHeight < size) {
                    image = image.resize(size, size, {
                        kernel: sharp.kernel.lanczos3,
                        withoutEnlargement: false,
                    });
                } else {
                    // 元の画像が128x128以上の場合は、Lanczos法で縮小
                    image = image.resize(size, size, {
                        kernel: sharp.kernel.lanczos3,
                        withoutEnlargement: true,
                    });
                }

                // 高画質化処理 (例: unsharp masking)
                // 必要に応じて調整
                image = image.sharpen({ sigma: 1.5 }); // シャープネスを調整 (例)

            } else {
                image = image.resize(size, size, { fit: 'fill', background: { r: 255, g: 255, b: 255, alpha: 1 } });
            }

            const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

            if (debugMode) {
                console.log(`[デバッグ] 画像情報: width=${info.width}, height=${info.height}, channels=${info.channels}`);
            }

            // 地図生成開始のメッセージ
            world.sendMessage(`(${startX}, ${startY}, ${startZ}) に地図の生成を開始します...`, sender);
            world.sendMessage(`§f§l[Server]§r 地図生成開始: プレイヤー=${playerName}, 座標=(${startX}, ${startY}, ${startZ})`);

            const startTime = Date.now();

            const startSignalX = startX;
            const startSignalY = startY + 1;
            const startSignalZ = startZ;
            await world.runCommand(`setblock ${startSignalX} ${startSignalY} ${startSignalZ} diamond_block replace`);

            let blockCount = 0;
            const totalBlocks = size * size;
            let lastMessageTime = startTime;

            for (let x = 0; x < size; x += NUM_COLUMNS) {
                for (let z = 0; z < size; z++) {
                    const promises: Promise<void>[] = [];
                    for (let i = 0; i < NUM_COLUMNS; i++) {
                        const currentX = x + i;
                        if (currentX < size) {
                            const pixelOffset = (z * info.width + currentX) * info.channels;
                            const pixel = {
                                r: data[pixelOffset],
                                g: data[pixelOffset + 1],
                                b: data[pixelOffset + 2],
                                a: info.channels >= 4 ? data[pixelOffset + 3] : 255
                            };

                            const block = getMinecraftBlock(pixel, currentX, z, size, data, info.channels, toolId);

                            const blockLocation = `${startX + currentX} ${startY} ${startZ + z}`;

                            if (debugMode) {
                                console.log(`[デバッグ] ブロック配置: 座標=(${startX + currentX}, ${startY}, ${startZ + z}), ブロック=${block}, RGB=(${pixel.r}, ${pixel.g}, ${pixel.b}), Alpha=${pixel.a}`);
                            }

                            promises.push(
                                new Promise<void>(async (resolve) => {
                                    const teleportX = startX + currentX;
                                    const teleportZ = startZ + z;
                                    await world.runCommand(`tp ${playerName} ${teleportX} ${startY + 15} ${teleportZ}`);

                                    await world.runCommand(`setblock ${blockLocation} ${block} replace`);
                                    blockCount++;

                                    // 進行状況を送信
                                    const currentTime = Date.now();
                                    if (currentTime - lastMessageTime >= 10000) { // 10秒ごとに更新
                                        const progress = Math.round((blockCount / totalBlocks) * 100);
                                        const elapsedTime = Math.round((currentTime - startTime) / 1000);
                                        const hours = Math.floor(elapsedTime / 3600); // 時間を計算
                                        const minutes = Math.floor((elapsedTime % 3600) / 60); // 分を計算
                                        const seconds = elapsedTime % 60; // 残りの秒数を計算
                                        world.sendMessage(`[地図生成] 進行度: ${progress}%  経過時間: ${hours}h${minutes}m${seconds}s`, sender);
                                        lastMessageTime = currentTime;
                                    }

                                    resolve();
                                })
                            );
                        }
                    }
                    await Promise.all(promises);
                    await new Promise(resolve => setTimeout(resolve, DELAY_TIME));
                }
            }

            // 地図生成完了のメッセージ
            world.sendMessage(`地図の生成が完了しました プレイヤー:${playerName} 合計:${blockCount} ブロックを配置しました。座標: ${startX}| ${startY}| ${startZ} `);
            if (debugMode) {
                console.log(`[デバッグ] 地図生成完了: 合計ブロック数=${blockCount}, プレイヤー=${playerName}`);
            }
        } catch (error) {
            console.error("地図生成エラー:", error);
            world.sendMessage("地図の生成に失敗しました。", sender);
        } finally {
            runningTasks.delete(playerName);
        }
    } catch (error) {
        console.error("コマンド実行エラー:", error);
        world.sendMessage("コマンドの実行に失敗しました。", sender);
        runningTasks.delete(playerName);
    }
});

// RGB値からMinecraftのブロックを決定する関数
function getMinecraftBlock(
    rgb: { r: number, g: number, b: number, a: number },
    x: number,
    z: number,
    size: number,
    data: Buffer,
    channels: number,
    toolId: number
): string {
    // ブロックの色とRGB値の対応表
    const blockColors = [
        { name: "white_wool", r: 233, g: 236, b: 236 },     // #E9ECEC
        { name: "orange_wool", r: 240, g: 118, b: 19 },     // #F07613
        { name: "magenta_wool", r: 189, g: 68, b: 179 },    // #BD44B3
        { name: "light_blue_wool", r: 58, g: 175, b: 217 },  // #3AAFD9
        { name: "yellow_wool", r: 248, g: 198, b: 39 },    // #F8C627
        { name: "lime_wool", r: 112, g: 185, b: 25 },      // #70B919
        { name: "pink_wool", r: 237, g: 141, b: 172 },     // #ED8DAC
        { name: "gray_wool", r: 62, g: 68, b: 71 },        // #3E4447
        { name: "light_gray_wool", r: 142, g: 142, b: 134 }, // #8E8E86
        { name: "cyan_wool", r: 21, g: 137, b: 145 },      // #158991
        { name: "purple_wool", r: 121, g: 42, b: 172 },    // #792AAC
        { name: "blue_wool", r: 53, g: 57, b: 157 },       // #35399D
        { name: "brown_wool", r: 114, g: 71, b: 40 },      // #724728
        { name: "green_wool", r: 84, g: 109, b: 27 },      // #546D1B
        { name: "red_wool", r: 161, g: 39, b: 34 },        // #A12722
        { name: "black_wool", r: 20, g: 21, b: 25 },       // #141519
        { name: "terracotta", r: 149, g: 87, b: 57 },       // #955739 (一般的なテラコッタ)
        { name: "white_terracotta", r: 209, g: 178, b: 161 }, // #D1B2A1
        { name: "orange_terracotta", r: 160, g: 83, b: 37 },  // #A05325
        { name: "magenta_terracotta", r: 149, g: 88, b: 108 }, // #95586C
        { name: "light_blue_terracotta", r: 113, g: 108, b: 137 },// #716C89
        { name: "yellow_terracotta", r: 187, g: 133, b: 36 }, // #BB8524
        { name: "lime_terracotta", r: 103, g: 117, b: 53 },  // #677535
        { name: "pink_terracotta", r: 161, g: 78, b: 78 },   // #A14E4E
        { name: "gray_terracotta", r: 57, g: 42, b: 35 },    // #392A23
        { name: "light_gray_terracotta", r: 136, g: 107, b: 98 },// #886B62
        { name: "cyan_terracotta", r: 87, g: 92, b: 92 },   // #575C5C
        { name: "purple_terracotta", r: 122, g: 73, b: 88 },  // #7A4958
        { name: "blue_terracotta", r: 76, g: 62, b: 92 },    // #4C3E5C
        { name: "brown_terracotta", r: 76, g: 51, b: 35 },   // #4C3323
        { name: "green_terracotta", r: 76, g: 83, b: 42 },   // #4C532A
        { name: "red_terracotta", r: 143, g: 61, b: 46 },    // #8F3D2E
        { name: "black_terracotta", r: 37, g: 22, b: 16 },   // #251610
    ];

    if (toolId === 1) {
        // 周囲のピクセルを考慮した平均色を計算 (toolId: 1)
        let avgR = 0, avgG = 0, avgB = 0;
        let count = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const nx = x + dx;
                const nz = z + dz;
                if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
                    const offset = (nz * size + nx) * channels;
                    avgR += data[offset];
                    avgG += data[offset + 1];
                    avgB += data[offset + 2];
                    count++;
                }
            }
        }
        avgR = Math.round(avgR / count);
        avgG = Math.round(avgG / count);
        avgB = Math.round(avgB / count);

        // 平均化されたRGB値に最も近いブロックの色を探す
        let closestColor: { name: string; r: number; g: number; b: number } | null = null;
        let minDistance = Number.MAX_VALUE;

        for (const color of blockColors) {
            const distance = Math.sqrt(
                Math.pow(avgR - color.r, 2) +
                Math.pow(avgG - color.g, 2) +
                Math.pow(avgB - color.b, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestColor = color;
            }
        }

        if (closestColor) {
            if (debugMode) {
                console.log(`[デバッグ] ブロック選択: 平均RGB=(${avgR}, ${avgG}, ${avgB}), 選択ブロック=${closestColor.name}`);
            }
            return closestColor.name;
        } else {
            if (debugMode) {
                console.log(`[デバッグ] ブロック選択: 適切なブロックが見つかりませんでした。デフォルトでglassを使用します。`);
            }
            return "glass"; // 適切な色が見つからない場合はデフォルトでガラスを返す
        }
    } else if (toolId === 2) {
        // 水彩画風の処理 (toolId: 2)
        const offset = (z * size + x) * channels;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];

        let watercolorR = Math.round(r * 0.8 + g * 0.1 + b * 0.1);
        let watercolorG = Math.round(r * 0.1 + g * 0.8 + b * 0.1);
        let watercolorB = Math.round(r * 0.1 + g * 0.1 + b * 0.8);

        // 色のばらつきを追加
        const variation = 20;
        watercolorR = Math.min(255, Math.max(0, watercolorR + (Math.random() - 0.5) * variation));
        watercolorG = Math.min(255, Math.max(0, watercolorG + (Math.random() - 0.5) * variation));
        watercolorB = Math.min(255, Math.max(0, watercolorB + (Math.random() - 0.5) * variation));

        // 最も近いMinecraftのブロックの色を探す
        let closestColor: { name: string; r: number; g: number; b: number } | null = null;
        let minDistance = Number.MAX_VALUE;

        for (const color of blockColors) {
            const distance = Math.sqrt(
                Math.pow(watercolorR - color.r, 2) +
                Math.pow(watercolorG - color.g, 2) +
                Math.pow(watercolorB - color.b, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestColor = color;
            }
        }

        if (closestColor) {
            if (debugMode) {
                console.log(`[デバッグ] ブロック選択: 水彩画風RGB=(${watercolorR}, ${watercolorG}, ${watercolorB}), 選択ブロック=${closestColor.name}`);
            }
            return closestColor.name;
        } else {
            if (debugMode) {
                console.log(`[デバッグ] ブロック選択: 適切なブロックが見つかりませんでした。デフォルトでglassを使用します。`);
            }
            return "glass";
        }
    } else {
        // 最近傍法 (toolId: 0 または無効な値)
        let closestColor: { name: string; r: number; g: number; b: number } | null = null;
        let minDistance = Number.MAX_VALUE;

        for (const color of blockColors) {
            const distance = Math.sqrt(
                Math.pow(rgb.r - color.r, 2) +
                Math.pow(rgb.g - color.g, 2) +
                Math.pow(rgb.b - color.b, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestColor = color;
            }
        }

        if (closestColor) {
            if (debugMode) {
                console.log(`[デバッグ] ブロック選択: 入力RGB=(${rgb.r}, ${rgb.g}, ${rgb.b}), 選択ブロック=${closestColor.name}`);
            }
            return closestColor.name;
        } else {
            if (debugMode) {
                console.log(`[デバッグ] ブロック選択: 適切なブロックが見つかりませんでした。デフォルトでglassを使用します。`);
            }
            return "glass"; // 適切な色が見つからない場合はデフォルトでガラスを返す
        }
    }
}