interface MinecraftEntry {
    keywords: string[];
    description: string;
    related: string[];
}

export const minecraftData: MinecraftEntry[] = [
    // ゲームの基本的なメカニズム
    {
        keywords: ["minecraft", "マイクラ", "マインクラフト"],
        description: "Mojang Studiosが開発したサンドボックス型ビデオゲームです。プレイヤーはブロック状の世界で自由に探索、創造、建築を行うことができます。",
        related: ["サバイバルモード", "クリエイティブモード", "建築", "採掘", "レッドストーン"],
    },
    {
        keywords: ["サバイバルモード", "サバイバル"],
        description: "プレイヤーは空腹、敵対的なMob、その他の危険から生き延びるために、食料を集め、アイテムを作成し、建造物を作る必要があります。",
        related: ["体力", "食料", "mob", "クラフティング", "建築"],
    },
    {
        keywords: ["クリエイティブモード", "クリエイティブ"],
        description: "プレイヤーは無制限のリソースと飛行能力を持ち、サバイバルの心配なく自由に創造性を発揮することができます。",
        related: ["建築", "飛行", "資源", "アイテム"],
    },
    {
        keywords: ["クラフティング", "工作"],
        description: "クラフティングテーブルや作業台を使って、材料を組み合わせて新しいアイテムを作成するシステムです。",
        related: ["アイテム", "ツール", "武器", "防具", "レシピ"],
    },
    {
        keywords: ["採掘", "鉱石採掘"],
        description: "ツルハシなどの道具を使って、石、鉱石、その他のブロックを壊して資源を集める行為です。",
        related: ["資源", "ツール", "鉱石", "洞窟", "ダイヤモンド"],
    },
    {
        keywords: ["建築", "建設"],
        description: "様々なブロックを使って、家、城、その他の構造物を建てるMinecraftの主要な要素の一つです。",
        related: ["ブロック", "デザイン", "建築物", "レッドストーン", "装飾"],
    },


    // モブ (敵や動物)
    {
        keywords: ["クリーパー", "creeper"],
        description: "プレイヤーに近づくと爆発する敵対的なMobです。",
        related: ["mob", "爆発", "サバイバルモード", "TNT"],
    },
    {
        keywords: ["ゾンビ", "zombie"],
        description: "夜間にスポーンする敵対的なアンデッドMobです。",
        related: ["mob", "腐った肉", "夜", "サバイバルモード"],
    },
    {
        keywords: ["エンダーマン", "enderman"],
        description: "テレポート能力を持つ敵対的なMobです。",
        related: ["mob", "テレポート", "エンダーパール", "ジ・エンド"],
    },
    {
        keywords: ["スケルトン", "skeleton"],
        description: "弓矢を使う敵対的なMobです。",
        related: ["mob", "弓", "矢", "夜", "サバイバルモード"],
    },
    {
        keywords: ["クモ", "spider"],
        description: "壁や天井を登ることができる敵対的なMobです。",
        related: ["mob", "毒", "夜", "洞窟"],
    },
    {
        keywords: ["ブタ", "pig"],
        description: "繁殖させることができ、鞍があれば乗ることができる受動的なMobです。",
        related: ["動物", "食料", "繁殖", "鞍"],
    },
    {
        keywords: ["牛", "cow"],
        description: "牛乳と牛肉をくれる受動的なMobです。",
        related: ["動物", "食料", "繁殖", "牛乳"],
    },
    {
        keywords: ["羊", "sheep"],
        description: "羊毛をくれる受動的なMobです。",
        related: ["動物", "羊毛", "繁殖", "染色"],
    },
    {
        keywords: ["鶏", "chicken"],
        description: "卵と鶏肉をくれる受動的なMobです。",
        related: ["動物", "食料", "繁殖", "卵"],
    },
    {
        keywords: ["ウサギ", "rabbit"],
        description: "様々な種類の肉と毛皮をくれる受動的なMobです。",
        related: ["動物", "食料", "繁殖", "毛皮"],
    },
    {
        keywords: ["村人", "villager"],
        description: "取引を行うことができるMobです。",
        related: ["取引", "エメラルド", "村", "職業"],
    },
    {
        keywords: ["ゾンビピッグマン", "zombie pigman"],
        description: "ネザーに生息する敵対的なMobです。",
        related: ["mob", "金インゴット", "ネザー", "サバイバルモード"],
    },
    {
        keywords: ["ガスト", "ghast"],
        description: "火の玉を吐く敵対的なMobです。",
        related: ["mob", "火の玉", "ネザー", "サバイバルモード"],
    },
    {
        keywords: ["マグマキューブ", "magma cube"],
        description: "マグマブロックの上を跳ねる敵対的なMobです。",
        related: ["mob", "マグマクリーム", "ネザー", "サバイバルモード"],
    },
    {
        keywords: ["ウィザー", "wither"],
        description: "非常に強力なボスMobです。",
        related: ["ボス", "ウィザーローズ", "ネザー", "サバイバルモード"],
    },
    {
        keywords: ["エンダー龍", "ender dragon"],
        description: "ジ・エンドのボスMobです。",
        related: ["ボス", "ジ・エンド", "エンドパール", "サバイバルモード"],
    },


    // 資源とアイテム
    {
        keywords: ["ダイヤモンド", "diamond"],
        description: "Minecraftで最も希少で価値のある鉱石で、強力なツールや防具の作成に使用されます。バージョン1.20ではy:－59以下 が出やすいみたいです",
        related: ["採掘", "ツール", "防具", "エンチャント"],
    },
    {
        keywords: ["鉄", "iron"],
        description: "ツール、武器、防具などを作るために使用される一般的な鉱石です。バージョン1.20ではY座標=16付近でよく出るようです。",
        related: ["ツール", "武器", "防具", "採掘"],
    },
    {
        keywords: ["古代のがれき", "古代の残骸", "ancient debris"],
        description: "ネザーにある現時点で最強の装備を作るのに使う鉱石です。バージョン1.20ではY座標=8～22付近でよく出るようです。",
        related: ["ツール", "武器", "防具", "採掘", "ネザー"],
    },
    {
        keywords: ["金", "gold"],
        description: "特定のツール、防具、装飾品の作成に使用される鉱石です。様々な高さで発見できます。",
        related: ["ツール", "防具", "装飾", "ネザー"],
    },
    {
        keywords: ["木材", "wood"],
        description: "木を切り倒して得られる基本的な資源です。",
        related: ["建築", "ツール", "燃料", "板"],
    },
    {
        keywords: ["レッドストーン", "redstone"],
        description: "複雑な回路や自動化メカニズムを作るために使用される素材です。地下深くで発見できます。",
        related: ["回路", "自動化", "メカニズム", "レッドストーンダスト"],
    },
    {
        keywords: ["石炭", "coal"],
        description: "燃料や、松明を作るために使用される鉱石です。比較的浅い地下で発見できます。",
        related: ["燃料", "松明", "採掘"],
    },
    {
        keywords: ["ラピスラズリ", "lapis lazuli"],
        description: "エンチャントテーブルの材料や、青い染料として使用されます。地下深くで発見できます。",
        related: ["エンチャント", "染料", "採掘"],
    },
    {
        keywords: ["エメラルド", "emerald"],
        description: "村人との取引に使われる貴重な鉱石です。山岳バイオームの高地で発見できます。",
        related: ["取引", "村人", "採掘"],
    },
    {
        keywords: ["砂利", "gravel"],
        description: "様々な用途を持つブロックです。",
        related: ["採掘", "建築", "コンクリート"],
    },
    {
        keywords: ["砂", "sand"],
        description: "ガラスや砂利を作るための材料です。",
        related: ["ガラス", "砂利", "建築"],
    },
    {
        keywords: ["粘土", "clay"],
        description: "レンガを作るための材料です。",
        related: ["レンガ", "建築"],
    },
    {
        keywords: ["黒曜石", "obsidian"],
        description: "ネザー要塞で発見され、強力なアイテムの材料となります。",
        related: ["ネザー", "要塞", "建築"],
    },


    // 次元とバイオーム
    {
        keywords: ["ネザー", "nether"],
        description: "ユニークな資源とMobが存在する危険な次元です。",
        related: ["次元", "mob", "資源", "溶岩", "要塞"],
    },
    {
        keywords: ["ジ・エンド", "the end"],
        description: "エンダー龍が生息する次元です。",
        related: ["次元", "エンダー龍", "エンダーパール", "拠点"],
    },
    {
        keywords: ["バイオーム", "biome"],
        description: "森林、砂漠、海洋など、固有の特徴を持つMinecraft世界の異なるエリアです。",
        related: ["環境", "地形", "気候", "地勢"],
    },
    {
        keywords: ["森林", "forest"],
        description: "木々が生い茂るバイオームです。",
        related: ["バイオーム", "木材", "動物"],
    },
    {
        keywords: ["砂漠", "desert"],
        description: "砂とサボテンが多いバイオームです。",
        related: ["バイオーム", "砂", "サボテン"],
    },
    {
        keywords: ["海洋", "ocean"],
        description: "水に覆われたバイオームです。",
        related: ["バイオーム", "水", "魚"],
    },
    {
        keywords: ["雪原", "snow"],
        description: "雪と氷に覆われたバイオームです。",
        related: ["バイオーム", "雪", "氷"],
    },
    {
        keywords: ["ジャングル", "jungle"],
        description: "密生したジャングル植物が生い茂るバイオームです。",
        related: ["バイオーム", "木", "つる"],
    },
    {
        keywords: ["山岳", "mountain"],
        description: "高い山々が連なるバイオームです。",
        related: ["バイオーム", "エメラルド", "高い場所"],
    },
    {
        keywords: ["沼地", "swamp"],
        description: "水と湿地帯が多いバイオームです。",
        related: ["バイオーム", "水", "湿地"],
    },
    {
        keywords: ["サバンナ", "savanna"],
        description: "草原と木々が点在するバイオームです。",
        related: ["バイオーム", "草原", "木"],
    },
    {
        keywords: ["タイガ", "taiga"],
        description: "針葉樹林が広がるバイオームです。",
        related: ["バイオーム", "針葉樹", "寒冷地"],
    },
    {
        keywords: ["氷床", "ice"],
        description: "氷と雪に覆われた広大なバイオームです。",
        related: ["バイオーム", "氷", "雪"],
    },
    {
        keywords: ["深層の洞窟", "deep dark"],
        description: "地下深くにある危険な洞窟バイオームです。",
        related: ["バイオーム", "洞窟", "危険"],
    },
    {
        keywords: ["アイテム", "item"],
        description: "ゲーム内で使用できる様々なオブジェクトの総称。",
        related: ["ツール", "武器", "防具", "資源"],
    },
    {
        keywords: ["ツール", "tool"],
        description: "ブロックを破壊したり、アイテムを作成するのに使用される道具。",
        related: ["ツルハシ", "オノ", "シャベル", "剣"],
    },
    {
        keywords: ["武器", "weapon"],
        description: "敵と戦うために使用されるアイテム。",
        related: ["剣", "弓", "トライデント"],
    },
    {
        keywords: ["防具", "armor"],
        description: "ダメージから身を守るためのアイテム。",
        related: ["ヘルメット", "チェストプレート", "レギンス", "ブーツ"],
    },
    {
        keywords: ["エンチャント", "enchantment"],
        description: "アイテムに特別な効果を付与するシステム。",
        related: ["経験値", "エンチャントテーブル", "魔法"],
    },
    {
        keywords: ["レッドストーン回路", "redstone circuit"],
        description: "レッドストーンを使って作られる複雑なメカニズム。",
        related: ["レッドストーン", "自動化", "トラップ"],
    },
    {
        keywords: ["ポーション", "potion"],
        description: "様々な効果を与える飲み薬。",
        related: ["醸造", "効果", "回復"],
    },
    {
        keywords: ["TNT", "tnt"],
        description: "爆発するアイテム。",
        related: ["爆発", "破壊", "クリーパー"],
    },
    {
        keywords: ["ベッド", "bed"],
        description: "睡眠をとるためのアイテム。",
        related: ["睡眠", "スポーンポイント"],
    },
    {
        keywords: ["チェスト", "chest"],
        description: "アイテムを保管するための容器。",
        related: ["収納", "アイテム"],
    },
    {
        keywords: ["ファーネス", "furnace"],
        description: "アイテムを焼くための装置。",
        related: ["調理", "精錬"],
    },

];