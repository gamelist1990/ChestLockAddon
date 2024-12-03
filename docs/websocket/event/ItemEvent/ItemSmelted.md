
## ItemSmelted Event

### Body
```typescript
interface ItemSmelted {
  fuelSource: {
    aux: number;           // 補助データ
    id: string;            // 燃料のID
    namespace: string;     // ネームスペース
  };
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
}
```

### Header
```typescript
interface EventHeader {
  eventName: string;       // イベント名
  messagePurpose: string;  // メッセージの目的
  version: number;         // バージョン
}

const header: EventHeader = {
  eventName: "ItemSmelted",
  messagePurpose: "event",
  version: 17039360
};
```