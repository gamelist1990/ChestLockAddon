
## MobKilled Event

### Body
```typescript
interface MobKilled {
  armorBody: {
    aux: number;               // 補助データ
    enchantments: any[];       // 付与されたエンチャント
    freeStackSize: number;     // 空きスタックサイズ
    id: string;                // アーマーのID
    maxStackSize: number;      // 最大スタックサイズ
    namespace: string;         // ネームスペース
    stackSize: number;         // スタックサイズ
  };
  armorFeet: {
    aux: number;               // 補助データ
    enchantments: any[];       // 付与されたエンチャント
    freeStackSize: number;     // 空きスタックサイズ
    id: string;                // アーマーのID
    maxStackSize: number;      // 最大スタックサイズ
    namespace: string;         // ネームスペース
    stackSize: number;         // スタックサイズ
  };
  armorHead: {
    aux: number;               // 補助データ
    enchantments: any[];       // 付与されたエンチャント
    freeStackSize: number;     // 空きスタックサイズ
    id: string;                // アーマーのID
    maxStackSize: number;      // 最大スタックサイズ
    namespace: string;         // ネームスペース
    stackSize: number;         // スタックサイズ
  };
  armorLegs: {
    aux: number;               // 補助データ
    enchantments: any[];       // 付与されたエンチャント
    freeStackSize: number;     // 空きスタックサイズ
    id: string;                // アーマーのID
    maxStackSize: number;      // 最大スタックサイズ
    namespace: string;         // ネームスペース
    stackSize: number;         // スタックサイズ
  };
  armorTorso: {
    aux: number;               // 補助データ
    enchantments: any[];       // 付与されたエンチャント
    freeStackSize: number;     // 空きスタックサイズ
    id: string;                // アーマーのID
    maxStackSize: number;      // 最大スタックサイズ
    namespace: string;         // ネームスペース
    stackSize: number;         // スタックサイズ
  };
  isMonster: boolean;          // モンスターかどうか
  killMethodType: number;      // キル方法のタイプ
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
  playerIsHiddenFrom: boolean; // プレイヤーが隠れているかどうか
  victim: {
    color: number;             // 被害者の色
    dimension: number;         // 次元
    id: number;                // 被害者のID
    position: {
      x: number;               // X座標
      y: number;               // Y座標
      z: number;               // Z座標
    };
    type: string;              // 被害者の種類
    variant: number;           // バリアント
    yRot: number;              // Y軸の回転
  };
  weapon: {
    aux: number;               // 補助データ
    enchantments: any[];       // 付与されたエンチャント
    freeStackSize: number;     // 空きスタックサイズ
    id: string;                // 武器のID
    maxStackSize: number;      // 最大スタックサイズ
    namespace: string;         // ネームスペース
    stackSize: number;         // スタックサイズ
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
  eventName: "MobKilled",
  messagePurpose: "event",
  version: 17039360
};
```

