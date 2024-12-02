
## PlayerTravelled Event

### Body
```typescript
interface PlayerTravelled {
  isUnderwater: boolean;       // 水中にいるかどうか
  metersTravelled: number;     // 移動距離（メートル）
  newBiome: number;            // 新しいバイオームのID
  player: {
    color: string;             // プレイヤーの色
    dimension: number;         // 次元
    id: number;                // プレイヤーのID
    name: string;              // プレイヤーの名前
    position: {
      x: number;               // X座標
      y: number;               // Y座標
      z: number;               // Z座標
    };
    type: string;              // エンティティの種類
    variant: number;           // バリアント
    yRot: number;              // Y軸の回転
  };
  travelMethod: number;        // 移動方法 0 =歩き 2=ジャンプ 8=走り 飛行=5 えりとら=通常時2 ダッシュ後使用で8
}
```

### Header
```typescript
interface EventHeader {
  eventName: string;           // イベント名
  messagePurpose: string;      // メッセージの目的
  version: number;             // バージョン
}

const header: EventHeader = {
  eventName: "PlayerTravelled",
  messagePurpose: "event",
  version: 17039360
};
```

