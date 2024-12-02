## BlockBroken Event

### あくまで仮定
```typescript
interface BlockBrokenEvent {
    player: {
        id: string;       // プレイヤーのid
        name: string;     // プレイヤーの名前
    };
    block: {
        id: string;       // ブロックの種類
        position: {
            x: number;    // X座標
            y: number;    // Y座標
            z: number;    // Z座標
        };
        metadata: string; // Meta Data
    };
    world: {
        id: string;       // ワールドのID
        name: string;     // ワールドの名前
    };
    timestamp: Date;       // 日時
}
```

