/**
 * Minecraft Bedrock Edition (BE) Script API を利用した、
 * 簡単なスパム検知と不適切な単語検知のサンプルコードです。 (Create by @PEXkurann & ChatGPT)
 *
 * 注意:
 * - これはあくまで基本的なサンプルであり、完全なアンチスパム/不適切発言対策ではありません。
 * - 実際の運用では、より高度な検知ロジック、ホワイトリスト/ブラックリスト、
 *   ミュート/BAN機能などを組み込む必要があります。
 * - Minecraft BE のバージョンによっては、API の仕様が変更されている可能性があります。
 */

import { world, system, Player } from "@minecraft/server";

// --- 設定 ---
const SPAM_THRESHOLD = 3; // スパムとみなすメッセージ数 (短時間にこれ以上のメッセージを送信するとスパムと判定)
const SPAM_INTERVAL = 5; // スパム判定のインターバル(秒) (この時間内に閾値以上のメッセージを送信するとスパム)
const BAD_WORDS = ["badword1", "badword2", "不適切な単語"]; // 不適切な単語のリスト (小文字で登録)
const WARN_MESSAGE = "§c[警告] 発言に注意してください。";  // 警告メッセージ
const SPAM_WARN_MESSAGE = "§c[警告] スパム行為は禁止されています。"; // スパム警告
const KICK_MESSAGE = "§c不適切な発言/スパム行為のため、キックされました。"; // キック時のメッセージ
const MUTE_DURATION = 60; // ミュート時間（秒）


// --- 変数 ---
//  プレイヤーごとのメッセージ送信履歴を保持するMap
//  { playerId:  { timestamp: number, count: number }[] }
const playerMessageHistory = new Map();
// ミュートされているプレイヤーを管理
const mutedPlayers = new Map(); // { playerId: unmuteTime }



// --- 関数 ---

/**
 * 不適切な単語が含まれているかチェックする関数
 * @param {string} message
 * @returns {boolean} 不適切な単語が含まれていれば true, そうでなければ false
 */
function containsBadWords(message) {
    const lowerMessage = message.toLowerCase();
    for (const word of BAD_WORDS) {
        if (lowerMessage.includes(word)) {
            return true;
        }
    }
    return false;
}


/**
 * プレイヤーをミュートする
 * @param {Player} player
 * @param {number} duration ミュート時間(秒)
 */
function mutePlayer(player, duration) {
    const playerId = player.id;
    const unmuteTime = Date.now() + duration * 1000;  //ミリ秒で管理
    mutedPlayers.set(playerId, unmuteTime);
    player.sendMessage(`§cあなたは${duration}秒間ミュートされました。`);
}

/**
 *  プレイヤーのミュートを解除する
 * @param {Player} player
 */
function unmutePlayer(player) {
    const playerId = player.id;
    if (mutedPlayers.has(playerId)) {
        mutedPlayers.delete(playerId);
        player.sendMessage("§aミュートが解除されました。");
    }
}


// --- イベントハンドラ ---

// プレイヤーがチャットメッセージを送信したときのイベント
world.beforeEvents.chatSend.subscribe((event) => {
    const player = event.sender;
    const playerId = player.id;
    const message = event.message;

    // 1. ミュートチェック
    if (mutedPlayers.has(playerId)) {
        const unmuteTime = mutedPlayers.get(playerId);
        if (Date.now() < unmuteTime) {
            event.cancel = true;
            player.sendMessage("§cあなたはミュートされています。");
            return;
        } else {
            //ミュート時間終了
            unmutePlayer(player);
        }
    }


    // 2. 不適切な単語のチェック
    if (containsBadWords(message)) {
        event.cancel = true; // メッセージの送信をキャンセル
        player.sendMessage(WARN_MESSAGE);
        // 不適切な単語を送信したプレイヤーへの対応 (警告、キック、ログ記録など)
        world.sendMessage(`§c[不適切発言検知] ${player.name}: ${message}`); // 全員に警告(管理者向け)
        // より厳しい対応の例：　即時キック
        //  player.kick(KICK_MESSAGE);
        mutePlayer(player, MUTE_DURATION);
        return;
    }


    // 3. スパムチェック
    const now = Date.now();
    let history = playerMessageHistory.get(playerId) || [];

    // 過去のメッセージ履歴をクリーンアップ (SPAM_INTERVAL より古いものは削除)
    history = history.filter((entry) => now - entry.timestamp <= SPAM_INTERVAL * 1000);

    // 現在のメッセージを履歴に追加
    history.push({ timestamp: now, count: 1 });
    playerMessageHistory.set(playerId, history);

    // スパム判定
    let totalMessages = 0;
    for (const entry of history) {
        totalMessages += entry.count;
    }

    if (totalMessages > SPAM_THRESHOLD) {
        event.cancel = true; // メッセージの送信をキャンセル
        player.sendMessage(SPAM_WARN_MESSAGE);

        world.sendMessage(`§c[スパム検知] ${player.name} (メッセージ数: ${totalMessages})`); // 管理者向け
        // スパム行為を行ったプレイヤーへの対応 (警告、キック、BAN、ミュートなど)
        // 例： 一定時間ミュート
        mutePlayer(player, MUTE_DURATION);

        // 履歴をクリアして、連続スパムと判定されないようにする。
        playerMessageHistory.delete(playerId);
    }
});


// 定期的にミュート時間を確認する
system.runInterval(() => {
    const now = Date.now();
    for (const [playerId, unmuteTime] of mutedPlayers) {
        if (now >= unmuteTime) {
            // get player object from id.  World.getAllPlayers() does not always work.
            let player = null;
            for (const p of world.getAllPlayers()) {
                if (p.id === playerId) {
                    player = p;
                    break;
                }
            }

            if (player) {
                unmutePlayer(player);
            } else {
                // player is offline
                mutedPlayers.delete(playerId);
            }
        }
    }
}, 20); // 1秒ごとにチェック (20 ticks = 1 second)