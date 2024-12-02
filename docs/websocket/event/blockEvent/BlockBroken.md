## BlockBroken Event


### Body
```ts
interface BlockBroken {
  block: {
    aux: number;           // 補助データ
    id: string;            // ブロックのID
    namespace: string;     // ネームスペース
  };
  count: number;           // ブロックの個数
  destructionMethod: number; // 破壊方法
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
  tool: {
    aux: number;           // 補助データ
    enchantments: any[];   // 付与されたエンチャント
    freeStackSize: number; // 空きスタックサイズ
    id: string;            // ツールのID
    maxStackSize: number;  // 最大スタックサイズ
    namespace: string;     // ネームスペース
    stackSize: number;     // スタックサイズ
  };
  variant: number;         // バリアント
}
```

## Header

```ts
interface EventHeader {
  eventName: string;       // イベント名
  messagePurpose: string;  // メッセージの目的
  version: number;         // バージョン
}

const header: EventHeader = {
  eventName: "BlockBroken",
  messagePurpose: "event",
  version: 17039360
};
  ```
