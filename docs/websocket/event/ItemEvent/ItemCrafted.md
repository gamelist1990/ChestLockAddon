
## ItemCrafted Event

### Body
```typescript
interface ItemCrafted {
  count: number;                // アイテムの個数
  craftedAutomatically: boolean; // 自動的にクラフトされたか
  endingTabId: number;           // 終了タブID
  hasCraftableFilterOn: boolean; // クラフト可能フィルターがオンかどうか
  item: {
    aux: number;                // 補助データ
    enchantments: any[];        // 付与されたエンチャント
    freeStackSize: number;      // 空きスタックサイズ
    id: string;                 // アイテムのID
    maxStackSize: number;       // 最大スタックサイズ
    namespace: string;          // ネームスペース
    stackSize: number;          // スタックサイズ
  };
  numberOfTabsChanged: number;   // 変更されたタブの数
  player: {
    color: string;              // プレイヤーの色
    dimension: number;          // 次元
    id: number;                 // プレイヤーのID
    name: string;               // プレイヤーの名前
    position: {
      x: number;                // X座標
      y: number;                // Y座標
      z: number;                // Z座標
    };
    type: string;               // エンティティの種類
    variant: number;            // バリアント
    yRot: number;               // Y軸の回転
  };
  recipeBookShown: boolean;      // レシピブックが表示されたかどうか
  startingTabId: number;         // 開始タブID
  usedCraftingTable: boolean;    // クラフティングテーブルを使用したか
  usedSearchBar: boolean;        // 検索バーを使用したか
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
  eventName: "ItemCrafted",
  messagePurpose: "event",
  version: 17039360
};
```

