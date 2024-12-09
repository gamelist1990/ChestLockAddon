import { registerCommand, MINECRAFT_COMMAND_PREFIX } from '../index';
import axios from 'axios'; // HTTPリクエスト用ライブラリ

registerCommand('shop', `${MINECRAFT_COMMAND_PREFIX}shop`, 'ショップ操作コマンド', false, async (sender, world) => {
    const subcommand = sender.replace(`${MINECRAFT_COMMAND_PREFIX}shop `, '').split(' ')[0];

    try {
        const webServerResponse = await axios.get('http://localhost:80');
        if (webServerResponse.status !== 200) {
            await world.sendMessage('§cWebサーバーに接続できません。しばらくしてからもう一度お試しください。', sender);
            return;
        }

        if (subcommand === 'create') {
            const shopName = sender;
            const password = generatePassword();


            try {
                const response = await axios.post('http://localhost:80/api/shop/create', { // Web APIのエンドポイント
                    shopName: shopName,
                    owner: sender,
                    password: password
                });

                if (response.status === 201) { 
                    await world.sendMessage(`§aショップ ${shopName} を作成しました。\nWebツールで以下の情報を使用してログインしてください。\n§bユーザー名: ${shopName}\n§bパスワード: ${password}\n§cパスワードは大切に保管してください。`, sender);
                } else {
                    await world.sendMessage(`§cショップの作成に失敗しました。Webサーバーエラー: ${response.status}`, sender);
                }
            } catch (error) {
                console.error("ショップ作成APIリクエストエラー:", error);
                await world.sendMessage(`§cショップの作成に失敗しました。`, sender);
            }

        } else {
            await world.sendMessage(`§c使用方法: /shop create`, sender);
        }

    } catch (error) {
        console.error("Webサーバー接続エラー:", error)
        await world.sendMessage('§cWebサーバーに接続できません。しばらくしてからもう一度お試しください。', sender);
    }
});



// パスワード生成関数 (例)
function generatePassword(length = 12): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}