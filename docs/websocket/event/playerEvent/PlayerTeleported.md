
## PlayerTeleported Event

### Body
```typescript
interface PlayerTeleported {
  cause: number;            // テレポートの原因
  itemType: number;         // アイテムの種類
  metersTravelled: number;  // 移動距離（メートル）
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
```

### Header
```typescript
interface EventHeader {
  eventName: string;        // イベント名
  messagePurpose: string;   // メッセージの目的
  version: number;          // バージョン
}

const header: EventHeader = {
  eventName: "PlayerTeleported",
  messagePurpose: "event",
  version: 17039360
};
```

