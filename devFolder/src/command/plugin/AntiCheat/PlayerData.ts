import { Player } from '@minecraft/server';

// グローバル変数として playerDataMap を宣言
const playerDataMap: Map<string, Map<string, any>> = new Map();

export class PlayerDataManager {

    /**
     * プレイヤーのデータマップを初期化します。
     * @param player - 初期化するプレイヤー
     */
    initialize(player: Player): void {
        if (!playerDataMap.has(player.name)) {
            playerDataMap.set(player.name, new Map());
        }
    }

    /**
     * プレイヤーに新しいデータを登録します。
     * @param player - データを登録するプレイヤー
     * @param key - データのキー
     * @param value - データの内容
     */
    registerData(player: Player, key: string, value: any): void {
        this.initialize(player); // プレイヤーのデータマップが存在することを確認
        const playerData = playerDataMap.get(player.name);
        playerData!.set(key, value);  // playerData は必ず存在するので ! を使用
    }

    /**
     * プレイヤーのデータを取得します。
     * @param player - データを取得するプレイヤー
     * @param key - 取得するデータのキー
     * @returns データの値。存在しない場合は undefined
     */
    getData(player: Player, key: string): any | undefined {
        const playerData = playerDataMap.get(player.name);
        return playerData ? playerData.get(key) : undefined;
    }

    /**
     * プレイヤーのデータを更新します。
     * @param player - データを更新するプレイヤー
     * @param key - 更新するデータのキー
     * @param value - 新しいデータの値
     */
    updateData(player: Player, key: string, value: any): void {
        // hasData ではなく has を使う（データマップの存在チェック）
        if (this.has(player)) {
            const playerData = playerDataMap.get(player.name);
            // データマップが存在すれば必ず set できる
            playerData!.set(key, value);
        }
    }

    /**
     * プレイヤーのデータを削除します。
     * @param player - データを削除するプレイヤー
     * @param key - 削除するデータのキー
     */
    removeData(player: Player, key: string): void {
        const playerData = playerDataMap.get(player.name);
        if (playerData) {
            playerData.delete(key);
        }
    }
    /**
    * プレイヤーのデータが存在するか確認します。  このメソッドは不要
    * @param player プレイヤー
    * @param key  キー
    */
    /*
    hasData(player: Player, key: string): boolean {
        const playerData = playerDataMap.get(player.name);
        return playerData ? playerData.has(key) : false;
    }
    */

    /**
     * プレイヤーのデータマップ全体を削除します。
     * @param player - データマップを削除するプレイヤー
     */
    reset(player: Player): void {
        playerDataMap.delete(player.name);
    }

    /**
      *  プレイヤーのデータマップが存在するか確認
      * @param player
      */
    has(player: Player): boolean {
        return playerDataMap.has(player.name);
    }
}