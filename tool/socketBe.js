import { Server } from 'socket-be';



const server = new Server({
    port: 8000,
    timezone: 'Asia/Tokyo',
});

server.events.on('serverOpen', async () => {
    console.log('サーバが起動');


});
const NAME = "SlashCommandExecuted"

server.events.on('worldAdd', async (event) => {
    console.log('worldと接続完了!');
    const { world } = event;
    world.subscribeEvent(NAME);
})






function safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    }, 2);
}

server.events.on('packetReceive', async (event) => {
    console.log("発火");
    const bodyAndHeader = {
        body: event.packet.body,
        header: event.packet.header
    };
    console.log(JSON.stringify(bodyAndHeader, null, 2));
});

server.events.on(`${NAME}`, async (event) => {
    console.log("発火");
    console.log(safeStringify(event))
});

/**
 * server.events.on('playerChat', async (event) => {

    //console.log(safeStringify(event))
    const message = event.message.trim();
    const args = message.split(' ');
    const command = args[0];

    if (command === "test") {
        try {
            const minecraftCommand = args.slice(1).join(' '); // testコマンド以降の文字列を結合
            if (!minecraftCommand) {  // 実行するコマンドがない場合の処理を追加
                event.world.sendMessage("§c実行するコマンドを入力してください。例: /test give @s diamond 1");
                return;
            }
            const result = await event.world.runCommand(minecraftCommand);
            // 成功/失敗にかかわらず結果をプレイヤーに伝える
            event.world.sendMessage(`§aコマンド実行結果: ${result.statusMessage}`, event.sender);
        } catch (error) {
            event.world.sendMessage("§cコマンド実行中にエラーが発生しました。", event.sender);
        }
    }
});
 */



