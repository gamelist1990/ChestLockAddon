// ItemUsed Event Body
interface ItemUsed {
    count: number;           // アイテムの個数
    item: {
        aux: number;           // 補助データ
        id: string;            // アイテムのID
        namespace: string;     // ネームスペース
    };
    player: {
        color: string;         // プレイヤーの色
        dimension: number;     // 次元
        id: number;            // プレイヤーのID
        name: string;          // プレイヤーの名前
        position: {
            x: number;           // X座標
            y: number;           // Y座標
            z: number;           // Z座標
        };
        type: string;          // エンティティの種類
        variant: number;       // バリアント
        yRot: number;          // Y軸の回転
    };
    useMethod: number;       // 使用方法
}

// PlayerDied Event Body
interface PlayerDied {
    cause: number;            // 死因
    inRaid: boolean;          // レイド中かどうか
    killer: {
        color: number;          // キラーの色
        id: number;             // キラーのID
        type: number;           // キラーのタイプ
        variant: number;        // キラーのバリアント
    } | null;                 // プレイヤーが死んだ場合、killer は null
    player: {
        color: string;          // プレイヤーの色
        dimension: number;      // 次元
        id: number;             // プレイヤーのID
        name: string;           // プレイヤーの名前
        position: {
            x: number;            // X座標
            y: number;            // Y座標
            z: number;            // Z座標
        };
        type: string;           // エンティティの種類
        variant: number;        // バリアント
        yRot: number;           // Y軸の回転
    };
}

// Event Header (共通)
interface EventHeader {
    eventName: string;       // イベント名
    messagePurpose: string;  // メッセージの目的
    version: number;         // バージョン
}


export { EventHeader, ItemUsed, PlayerDied }