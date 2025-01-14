import { registerCommand, Player, world } from "../backend";
import { ver } from "../version";

registerCommand({
    name: 'about',
    description: 'このサーバーに関する情報を表示します。',
    maxArgs: 0,
    minArgs: 0,
    config: {
        enabled: true,
        adminOnly: false,
        requireTag: []
    },
    executor: async (player: Player) => {
        // ワールド情報 (存在する場合)
        if (world) {
            world.sendMessage("Worldオブジェクトのテスト");
            world.sendMessage(`Name: ${player.name}`);
            world.sendMessage(`UUID: ${player.uuid}`);
            world.sendMessage(`ID: ${player.id}`);
            world.sendMessage(`dimension: ${player.dimension}`);
            world.sendMessage(`position: x.${player.position.x} y.${player.position.y} z.${player.position.z}`);
        }

        // プレイヤー情報とサーバーバージョン
        player.sendMessage('【サーバーとクライアント間の処理分担アルゴリズム (実験中)】'); // 見出しで強調

        player.sendMessage('このサーバーでは、クライアントとサーバーが連携して処理を行う新しいアルゴリズムを実験的に導入しています。');

        player.sendMessage('■ 仕組み:');
        player.sendMessage('1. クライアント: 処理してほしいデータをサーバーに送信します。');
        player.sendMessage('2. サーバー: データを受け取り、必要な計算や処理を実行します。');
        player.sendMessage('3. サーバー: 処理結果をクライアントに送り返します。');
        player.sendMessage('4. クライアント: 結果を受け取り、それに基づいてゲーム内の表示や動作を更新します。');

        player.sendMessage('■ 利点:');
        player.sendMessage('・リアルタイム性: サーバーと常に通信するため、データの更新や変更を即座にゲームに反映できます。');
        player.sendMessage('・処理負荷の分散: 重い処理をサーバーが担当することで、クライアントの負荷を軽減し、スムーズなゲーム体験を提供します。');
        player.sendMessage('・クライアントへの依存を軽減: サーバーが中心となって処理を行うため、クライアントの種類や性能に依存せずに、一貫したゲーム体験を提供しやすくなります。');

        player.sendMessage('■ 例:');
        player.sendMessage('プレイヤーの統計情報計算、複雑なAIの挙動計算、リアルタイムのデータ同期など、様々な用途に活用できます。');

        player.sendMessage("現在のサーバーのバージョンは"+ ver)
    }
});