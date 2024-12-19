// 仮のBAN情報
interface BanPlayer {
    name: string;
    id: string;
    reason: string;
    duration?: number;
    banTime?: number;
    unban: 'true' | 'false';
}

interface BanList {
    banPlayers: BanPlayer[];
}

let banList: BanList = { banPlayers: [] };

function simulatePlayerAction(player: any, action: string) {
    const playerXuid = player.id;
    const playerName = player.name;
    console.log(`[SIMULATION] Player ${playerName} (${playerXuid}) - Action: ${action}`);

    let isBanned = false;
    let banInfo: BanPlayer | undefined; 

    banList.banPlayers.forEach((bannedPlayer) => {
        if (bannedPlayer.id === playerXuid || bannedPlayer.name === playerName) {
            isBanned = true;
            banInfo = bannedPlayer;
        }
    });

    if (isBanned) {
        if (banInfo) { 
            if (banInfo.unban === 'true') {
                console.log(`[SIMULATION]  ${playerName} (${playerXuid}) - BAN解除済み。`);
                return;
            }
            if (banInfo.duration && banInfo.banTime) {
                const currentTime = Date.now();
                const banEndTime = banInfo.banTime + banInfo.duration * 1000;
                if (currentTime >= banEndTime) {
                    console.log(`[SIMULATION] ${playerName} (${playerXuid}) - BAN期限切れ。`);
                    return;
                } else {
                    console.log(`[SIMULATION] ${playerName} (${playerXuid}) - BAN期間中、残り時間： ${formatTime(Math.ceil((banInfo.banTime + banInfo.duration * 1000 - currentTime) / 1000))}`);
                }
            } else {
                console.log(`[SIMULATION] ${playerName} (${playerXuid}) - 永久BAN`);
            }
        }
    } else {
        console.log(`[SIMULATION] ${playerName} (${playerXuid}) - BANされていません。`);
    }
}

function formatTime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds -= days * 24 * 60 * 60;
    const hours = Math.floor(seconds / (60 * 60));
    seconds -= hours * 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    let formattedTime = "";
    if (days > 0) formattedTime += `${days}d `;
    if (hours > 0) formattedTime += `${hours}h `;
    if (minutes > 0) formattedTime += `${minutes}m `;
    if (seconds > 0) formattedTime += `${seconds}s`;
    return formattedTime.trim();
}

interface MockPlayer {
    name: string;
    id: string;
    sendMessage: (message: string) => void;
    runCommand: (command: string) => void;
    hasTag: (tag: string) => boolean;
    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;
}
function createMockPlayer(name: string, id: string): MockPlayer {
    return {
        name: name,
        id: id,
        sendMessage: (message: string) => { console.log(`[Player Message] ${name} (${id}): ${message}`); },
        runCommand: (command: string) => { console.log(`[Player Command] ${name} (${id}): ${command}`); },
        hasTag: (_tag: string) => false,
        addTag: (_tag: string) => { },
        removeTag: (_tag: string) => { },
    };
}



banList = {
    banPlayers: [
        { name: 'TestPlayer1', id: 'player1_xuid', reason: '不正行為', unban: 'false' },
        { name: 'TestPlayer2', id: 'player2_xuid', reason: '荒らし行為', duration: 3600, banTime: Date.now(), unban: 'false' }, // 1時間の期限付きBAN
        { name: 'TestPlayer3', id: 'player3_xuid', reason: 'テスト', duration: 30, banTime: Date.now() - 29000, unban: 'false' }, // 期限切れ
        { name: 'TestPlayer4', id: 'player4_xuid', reason: 'テスト', unban: 'true' }, // BAN解除済み
    ],
};


console.log('========== サーバー起動時 ==========');
banList.banPlayers.forEach((bannedPlayer) => {
    const mockPlayer = createMockPlayer(bannedPlayer.name!, bannedPlayer.id!);
    simulatePlayerAction(mockPlayer, 'server start');
});

console.log('\n========== シミュレーション開始 ==========');
// プレイヤー作成
const player1 = createMockPlayer('TestPlayer1', 'player1_xuid');
const player2 = createMockPlayer('TestPlayer2', 'player2_xuid');
const player3 = createMockPlayer('TestPlayer3', 'player3_xuid');
const player4 = createMockPlayer('TestPlayer4', 'player4_xuid');
const player5 = createMockPlayer('TestPlayer5', 'player5_xuid'); // BANされていないプレイヤー

// 各プレイヤーの行動をシミュレート
simulatePlayerAction(player1, '接続'); // 永久BAN
simulatePlayerAction(player2, '接続'); // 時間BAN中
simulatePlayerAction(player2, 'コマンド実行');
simulatePlayerAction(player2, 'チャット送信');

simulatePlayerAction(player3, '接続'); // 期限切れ

simulatePlayerAction(player4, '接続'); // BAN解除済み

simulatePlayerAction(player5, '接続'); // BANされていない

setTimeout(() => {
    console.log('\n========== 10秒後 ==========')
    simulatePlayerAction(player2, '接続');
    simulatePlayerAction(player3, '接続');
}, 10000);


banList.banPlayers = banList.banPlayers.filter((ban) => ban.name !== 'TestPlayer1');
console.log("\n========== TestPlayer1 BAN解除後 ==========");
simulatePlayerAction(player1, '接続')
console.log('========== シミュレーション終了 ==========');