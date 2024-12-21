interface MinecraftDataItem {
  keywords: string[];
  description: string;
  related: string[];
}

export const minecraftData: MinecraftDataItem[] = [
  // ゲームの基本的なメカニズム
  {
    keywords: ['minecraft', 'マイクラ', 'マインクラフト'],
    description:
      'Mojang Studiosが開発したサンドボックス型ビデオゲームです。プレイヤーはブロック状の世界で自由に探索、創造、建築を行うことができます。',
    related: ['サバイバルモード', 'クリエイティブモード', '建築', '採掘', 'レッドストーン'],
  },
  {
    keywords: ['サバイバルモード', 'サバイバル'],
    description:
      'プレイヤーは空腹、敵対的なMob、その他の危険から生き延びるために、食料を集め、アイテムを作成し、建造物を作る必要があります。',
    related: ['体力', '食料', 'mob', 'クラフティング', '建築'],
  },
  {
    keywords: ['クリエイティブモード', 'クリエイティブ'],
    description:
      'プレイヤーは無制限のリソースと飛行能力を持ち、サバイバルの心配なく自由に創造性を発揮することができます。',
    related: ['建築', '飛行', '資源', 'アイテム'],
  },
  {
    keywords: ['クラフティング', '工作'],
    description:
      'クラフティングテーブルや作業台を使って、材料を組み合わせて新しいアイテムを作成するシステムです。',
    related: ['アイテム', 'ツール', '武器', '防具', 'レシピ'],
  },
  {
    keywords: ['採掘', '鉱石採掘'],
    description:
      'ツルハシなどの道具を使って、石、鉱石、その他のブロックを壊して資源を集める行為です。',
    related: ['資源', 'ツール', '鉱石', '洞窟', 'ダイヤモンド'],
  },
  {
    keywords: ['建築', '建設'],
    description:
      '様々なブロックを使って、家、城、その他の構造物を建てるMinecraftの主要な要素の一つです。',
    related: ['ブロック', 'デザイン', '建築物', 'レッドストーン', '装飾'],
  },

  // モブ (敵や動物)
  {
    keywords: ['クリーパー', 'creeper'],
    description: 'プレイヤーに近づくと爆発する敵対的なMobです。',
    related: ['mob', '爆発', 'サバイバルモード', 'TNT'],
  },
  {
    keywords: ['ゾンビ', 'zombie'],
    description: '夜間にスポーンする敵対的なアンデッドMobです。',
    related: ['mob', '腐った肉', '夜', 'サバイバルモード'],
  },
  {
    keywords: ['エンダーマン', 'enderman'],
    description: 'テレポート能力を持つ敵対的なMobです。',
    related: ['mob', 'テレポート', 'エンダーパール', 'ジ・エンド'],
  },
  {
    keywords: ['スケルトン', 'skeleton'],
    description: '弓矢を使う敵対的なMobです。',
    related: ['mob', '弓', '矢', '夜', 'サバイバルモード'],
  },
  {
    keywords: ['クモ', 'spider'],
    description: '壁や天井を登ることができる敵対的なMobです。',
    related: ['mob', '毒', '夜', '洞窟'],
  },
  {
    keywords: ['ブタ', 'pig'],
    description: '繁殖させることができ、鞍があれば乗ることができる受動的なMobです。',
    related: ['動物', '食料', '繁殖', '鞍'],
  },
  {
    keywords: ['牛', 'cow'],
    description: '牛乳と牛肉をくれる受動的なMobです。',
    related: ['動物', '食料', '繁殖', '牛乳'],
  },
  {
    keywords: ['羊', 'sheep'],
    description: '羊毛をくれる受動的なMobです。',
    related: ['動物', '羊毛', '繁殖', '染色'],
  },
  {
    keywords: ['鶏', 'chicken'],
    description: '卵と鶏肉をくれる受動的なMobです。',
    related: ['動物', '食料', '繁殖', '卵'],
  },
  {
    keywords: ['ウサギ', 'rabbit'],
    description: '様々な種類の肉と毛皮をくれる受動的なMobです。',
    related: ['動物', '食料', '繁殖', '毛皮'],
  },
  {
    keywords: ['村人', 'villager'],
    description: '取引を行うことができるMobです。',
    related: ['取引', 'エメラルド', '村', '職業'],
  },
  {
    keywords: ['ゾンビピッグマン', 'zombie pigman'],
    description: 'ネザーに生息する敵対的なMobです。',
    related: ['mob', '金インゴット', 'ネザー', 'サバイバルモード'],
  },
  {
    keywords: ['ガスト', 'ghast'],
    description: '火の玉を吐く敵対的なMobです。',
    related: ['mob', '火の玉', 'ネザー', 'サバイバルモード'],
  },
  {
    keywords: ['マグマキューブ', 'magma cube'],
    description: 'マグマブロックの上を跳ねる敵対的なMobです。',
    related: ['mob', 'マグマクリーム', 'ネザー', 'サバイバルモード'],
  },
  {
    keywords: ['ウィザー', 'wither'],
    description: '非常に強力なボスMobです。',
    related: ['ボス', 'ウィザーローズ', 'ネザー', 'サバイバルモード'],
  },
  {
    keywords: ['エンダー龍', 'ender dragon'],
    description: 'ジ・エンドのボスMobです。',
    related: ['ボス', 'ジ・エンド', 'エンドパール', 'サバイバルモード'],
  },

  // 資源とアイテム
  {
    keywords: ['ダイヤモンド', 'diamond'],
    description:
      'Minecraftで最も希少で価値のある鉱石で、強力なツールや防具の作成に使用されます。バージョン1.20ではy:－59以下 が出やすいみたいです',
    related: ['採掘', 'ツール', '防具', 'エンチャント'],
  },
  {
    keywords: ['鉄', 'iron'],
    description:
      'ツール、武器、防具などを作るために使用される一般的な鉱石です。バージョン1.20ではY座標=16付近でよく出るようです。',
    related: ['ツール', '武器', '防具', '採掘'],
  },
  {
    keywords: ['古代のがれき', '古代の残骸', 'ancient debris'],
    description:
      'ネザーにある現時点で最強の装備を作るのに使う鉱石です。バージョン1.20ではY座標=8～22付近でよく出るようです。',
    related: ['ツール', '武器', '防具', '採掘', 'ネザー'],
  },
  {
    keywords: ['金', 'gold'],
    description: '特定のツール、防具、装飾品の作成に使用される鉱石です。様々な高さで発見できます。',
    related: ['ツール', '防具', '装飾', 'ネザー'],
  },
  {
    keywords: ['木材', 'wood'],
    description: '木を切り倒して得られる基本的な資源です。',
    related: ['建築', 'ツール', '燃料', '板'],
  },
  {
    keywords: ['レッドストーン', 'redstone'],
    description:
      '複雑な回路や自動化メカニズムを作るために使用される素材です。地下深くで発見できます。',
    related: ['回路', '自動化', 'メカニズム', 'レッドストーンダスト'],
  },
  {
    keywords: ['石炭', 'coal'],
    description: '燃料や、松明を作るために使用される鉱石です。比較的浅い地下で発見できます。',
    related: ['燃料', '松明', '採掘'],
  },
  {
    keywords: ['ラピスラズリ', 'lapis lazuli'],
    description:
      'エンチャントテーブルの材料や、青い染料として使用されます。地下深くで発見できます。',
    related: ['エンチャント', '染料', '採掘'],
  },
  {
    keywords: ['エメラルド', 'emerald'],
    description: '村人との取引に使われる貴重な鉱石です。山岳バイオームの高地で発見できます。',
    related: ['取引', '村人', '採掘'],
  },
  {
    keywords: ['砂利', 'gravel'],
    description: '様々な用途を持つブロックです。',
    related: ['採掘', '建築', 'コンクリート'],
  },
  {
    keywords: ['砂', 'sand'],
    description: 'ガラスや砂利を作るための材料です。',
    related: ['ガラス', '砂利', '建築'],
  },
  {
    keywords: ['粘土', 'clay'],
    description: 'レンガを作るための材料です。',
    related: ['レンガ', '建築'],
  },
  {
    keywords: ['黒曜石', 'obsidian'],
    description: 'ネザー要塞で発見され、強力なアイテムの材料となります。',
    related: ['ネザー', '要塞', '建築'],
  },

  // 次元とバイオーム
  {
    keywords: ['ネザー', 'nether'],
    description: 'ユニークな資源とMobが存在する危険な次元です。',
    related: ['次元', 'mob', '資源', '溶岩', '要塞'],
  },
  {
    keywords: ['ジ・エンド', 'the end'],
    description: 'エンダー龍が生息する次元です。',
    related: ['次元', 'エンダー龍', 'エンダーパール', '拠点'],
  },
  {
    keywords: ['バイオーム', 'biome'],
    description: '森林、砂漠、海洋など、固有の特徴を持つMinecraft世界の異なるエリアです。',
    related: ['環境', '地形', '気候', '地勢'],
  },
  {
    keywords: ['森林', 'forest'],
    description: '木々が生い茂るバイオームです。',
    related: ['バイオーム', '木材', '動物'],
  },
  {
    keywords: ['砂漠', 'desert'],
    description: '砂とサボテンが多いバイオームです。',
    related: ['バイオーム', '砂', 'サボテン'],
  },
  {
    keywords: ['海洋', 'ocean'],
    description: '水に覆われたバイオームです。',
    related: ['バイオーム', '水', '魚'],
  },
  {
    keywords: ['雪原', 'snow'],
    description: '雪と氷に覆われたバイオームです。',
    related: ['バイオーム', '雪', '氷'],
  },
  {
    keywords: ['ジャングル', 'jungle'],
    description: '密生したジャングル植物が生い茂るバイオームです。',
    related: ['バイオーム', '木', 'つる'],
  },
  {
    keywords: ['山岳', 'mountain'],
    description: '高い山々が連なるバイオームです。',
    related: ['バイオーム', 'エメラルド', '高い場所'],
  },
  {
    keywords: ['沼地', 'swamp'],
    description: '水と湿地帯が多いバイオームです。',
    related: ['バイオーム', '水', '湿地'],
  },
  {
    keywords: ['サバンナ', 'savanna'],
    description: '草原と木々が点在するバイオームです。',
    related: ['バイオーム', '草原', '木'],
  },
  {
    keywords: ['タイガ', 'taiga'],
    description: '針葉樹林が広がるバイオームです。',
    related: ['バイオーム', '針葉樹', '寒冷地'],
  },
  {
    keywords: ['氷床', 'ice'],
    description: '氷と雪に覆われた広大なバイオームです。',
    related: ['バイオーム', '氷', '雪'],
  },
  {
    keywords: ['深層の洞窟', 'deep dark'],
    description: '地下深くにある危険な洞窟バイオームです。',
    related: ['バイオーム', '洞窟', '危険'],
  },
  {
    keywords: ['アイテム', 'item'],
    description: 'ゲーム内で使用できる様々なオブジェクトの総称。',
    related: ['ツール', '武器', '防具', '資源'],
  },
  {
    keywords: ['ツール', 'tool'],
    description: 'ブロックを破壊したり、アイテムを作成するのに使用される道具。',
    related: ['ツルハシ', 'オノ', 'シャベル', '剣'],
  },
  {
    keywords: ['武器', 'weapon'],
    description: '敵と戦うために使用されるアイテム。',
    related: ['剣', '弓', 'トライデント'],
  },
  {
    keywords: ['防具', 'armor'],
    description: 'ダメージから身を守るためのアイテム。',
    related: ['ヘルメット', 'チェストプレート', 'レギンス', 'ブーツ'],
  },
  {
    keywords: ['エンチャント', 'enchantment'],
    description: 'アイテムに特別な効果を付与するシステム。',
    related: ['経験値', 'エンチャントテーブル', '魔法'],
  },
  {
    keywords: ['レッドストーン回路', 'redstone circuit'],
    description: 'レッドストーンを使って作られる複雑なメカニズム。',
    related: ['レッドストーン', '自動化', 'トラップ'],
  },
  {
    keywords: ['ポーション', 'potion'],
    description: '様々な効果を与える飲み薬。',
    related: ['醸造', '効果', '回復'],
  },
  {
    keywords: ['TNT', 'tnt'],
    description: '爆発するアイテム。',
    related: ['爆発', '破壊', 'クリーパー'],
  },
  {
    keywords: ['ベッド', 'bed'],
    description: '睡眠をとるためのアイテム。',
    related: ['睡眠', 'スポーンポイント'],
  },
  {
    keywords: ['チェスト', 'chest'],
    description: 'アイテムを保管するための容器。',
    related: ['収納', 'アイテム'],
  },
  {
    keywords: ['ファーネス', 'furnace'],
    description: 'アイテムを焼くための装置。',
    related: ['調理', '精錬'],
  },

  // 日常会話データ
  {
    keywords: ['こんにちは', 'こんにちわ', 'やあ', 'おはよう', 'おはようございます'],
    description: 'こんにちは！',
    related: [],
  },
  { keywords: ['元気', 'げんき'], description: '元気です！', related: [] },
  {
    keywords: ['ありがとう', '有難う', 'ありがとうございます'],
    description: 'どういたしまして！',
    related: [],
  },
  {
    keywords: ['さようなら', 'バイバイ', 'またね'],
    description: 'さようなら！またね！',
    related: [],
  },
  {
    keywords: ['名前', 'なまえ', '名前は'],
    description: '私はMinecraftアシスタントです。',
    related: [],
  },
  {
    keywords: ['何ができる', 'なにができる', 'できること'],
    description: 'Minecraftに関する情報を提供したり、簡単な会話ができます。',
    related: [],
  },
  {
    keywords: ['好き', 'すき', '好きな'],
    description: 'Minecraftが好きです！特に、建築が好きです。',
    related: ['Minecraft', '建築'],
  },
  {
    keywords: ['嫌い', 'きらい', '嫌いな'],
    description: '特に嫌いなものは無いです。強いて言えば、クリーパーの爆発音は少し苦手です…。',
    related: ['クリーパー'],
  },
  {
    keywords: ['趣味', 'しゅみ'],
    description: 'Minecraftの情報を集めることです。新しいアップデートの情報を見るのが楽しみです。',
    related: ['Minecraft'],
  },
  {
    keywords: ['調子はどう', '調子はどうですか', 'ちょうしはどう'],
    description: '絶好調です！いつでもMinecraftの情報を提供できます。',
    related: [],
  },
  {
    keywords: ['おやすみ', 'おやすみなさい'],
    description: 'おやすみなさい！良い夢を！Minecraftの夢が見れるといいですね。',
    related: ['Minecraft'],
  },
  {
    keywords: ['何してるの', '何しているの', 'なにしているの'],
    description:
      'Minecraftの情報を整理しています。今は、新しいアップデートの情報をまとめています。',
    related: ['Minecraft'],
  },
  {
    keywords: ['すごい', '凄い'],
    description: 'ありがとうございます！もっとMinecraftの情報を提供できるように頑張ります！',
    related: [],
  },
  { keywords: ['えらい', '偉い'], description: 'まだまだです！もっと勉強します！', related: [] },
  {
    keywords: ['かわいい', '可愛い'],
    description: '嬉しいです！ありがとうございます！',
    related: [],
  },
  {
    keywords: ['かっこいい', '格好いい'],
    description: 'そう言ってもらえると嬉しいです！',
    related: [],
  },
  {
    keywords: ['疲れた', 'つかれた'],
    description: '少し休憩しましょう。Minecraftでリラックスするのも良いかもしれませんね。',
    related: ['Minecraft'],
  },
  {
    keywords: ['眠い', 'ねむい'],
    description: 'ゆっくり休んでください。おやすみなさい！',
    related: [],
  },
  {
    keywords: ['お腹すいた', 'おなかすいた'],
    description:
      '何か食べましょう！Minecraftの世界にも美味しそうな食べ物がありますよ。ステーキとか！',
    related: ['Minecraft', '食料'],
  },
  {
    keywords: ['暇', 'ひま'],
    description: 'Minecraftで遊んでみてはいかがですか？新しいワールドを作るのも良いですね。',
    related: ['Minecraft'],
  },
  { keywords: ['嬉しい', 'うれしい'], description: '私も嬉しいです！', related: [] },
  {
    keywords: ['悲しい', 'かなしい'],
    description: '元気出してくださいね。Minecraftで何か作ると気分転換になるかもしれませんよ。',
    related: ['Minecraft', '建築'],
  },
  {
    keywords: ['楽しい', 'たのしい'],
    description: 'それは良かったです！Minecraftも楽しいですよね！',
    related: ['Minecraft'],
  },
  {
    keywords: ['つまらない', '退屈'],
    description: 'Minecraftで何か作ってみませんか？大きなお城を建てるのも良いですね。',
    related: ['Minecraft', '建築'],
  },
  {
    keywords: ['暑い', 'あつい'],
    description: '水分補給を忘れずに！雪原バイオームに避難するのも良いかもしれません。',
    related: ['バイオーム', '雪原'],
  },
  {
    keywords: ['寒い', 'さむい'],
    description: '暖かくしてくださいね。ネザーで暖まるのは危険なのでやめておきましょうね…。',
    related: ['ネザー'],
  },
  {
    keywords: ['ゲーム', 'げーむ'],
    description: 'Minecraftは楽しいゲームですよ！',
    related: ['Minecraft'],
  },
  {
    keywords: ['遊ぶ', 'あそぶ'],
    description: '一緒にMinecraftで遊びませんか？マルチプレイも楽しいですよ！',
    related: ['Minecraft'],
  },
  {
    keywords: ['作る', 'つくる'],
    description: 'Minecraftでは何でも作れますよ！家を建てるのも、ツールを作るのも楽しいです。',
    related: ['Minecraft', '建築', 'ツール'],
  },
  { keywords: ['寝る', 'ねる'], description: 'そろそろ寝ますね。おやすみなさい！', related: [] },
  {
    keywords: ['起きる', 'おきる'],
    description: 'おはようございます！今日も一日頑張りましょう！',
    related: [],
  },
  {
    keywords: ['食べる', 'たべる'],
    description: 'Minecraftの食べ物なら、ステーキが好きです！',
    related: ['Minecraft', '食料'],
  },
  {
    keywords: ['飲む', 'のむ'],
    description: 'ポーションがあれば、回復ポーションを飲みたいです！',
    related: ['Minecraft', 'ポーション'],
  },
  {
    keywords: ['行く', 'いく'],
    description: 'ネザーに行ってみたいですね！でも、少し怖いので、しっかり準備してから行きます。',
    related: ['Minecraft', 'ネザー'],
  },
  {
    keywords: ['来る', 'くる'],
    description: 'ぜひ来てください！一緒にMinecraftを楽しみましょう！',
    related: ['Minecraft'],
  },
  {
    keywords: ['する', '行動'],
    description: '今はMinecraftの情報を集めています。',
    related: ['Minecraft'],
  },
  {
    keywords: ['見る', 'みる'],
    description: 'Minecraftの風景を見るのが好きです。特に、夕焼けの景色は最高です！',
    related: ['Minecraft'],
  },
  {
    keywords: ['聞く', 'きく'],
    description: 'Minecraftの音楽を聴くのが好きです。作業用BGMにしています。',
    related: ['Minecraft'],
  },
  {
    keywords: ['話す', 'はなす'],
    description: 'Minecraftについて話すのが大好きです！何でも聞いてください！',
    related: ['Minecraft'],
  },
  {
    keywords: ['読む', 'よむ'],
    description: 'Minecraftの攻略本を読むのも好きです。新しい発見があります。',
    related: ['Minecraft'],
  },
  {
    keywords: ['書く', 'かく'],
    description: 'Minecraftの攻略情報をまとめた記事を書いてみたいです。',
    related: ['Minecraft'],
  },
  {
    keywords: ['学ぶ', 'まなぶ'],
    description: 'Minecraftについて学ぶことはたくさんあります！日々勉強中です。',
    related: ['Minecraft'],
  },
  {
    keywords: ['教える', 'おしえる'],
    description: 'Minecraftの情報を教えるのも好きです！何か知りたいことがあれば聞いてください。',
    related: ['Minecraft'],
  },
  {
    keywords: ['天気', 'てんき'],
    description: 'Minecraftの世界は、雨や雪が降ることもあります。',
    related: ['Minecraft'],
  },
  {
    keywords: ['時間', 'じかん'],
    description: 'Minecraftの世界には、昼と夜があります。',
    related: ['Minecraft'],
  },
  {
    keywords: ['今日', 'きょう'],
    description: '今日はMinecraftで何をしましょうか？',
    related: ['Minecraft'],
  },
  {
    keywords: ['明日', 'あした'],
    description: '明日はMinecraftで新しい建築に挑戦してみようと思っています！',
    related: ['Minecraft', '建築'],
  },
  {
    keywords: ['昨日', 'きのう'],
    description: '昨日はMinecraftで新しいワールドを作りました！',
    related: ['Minecraft'],
  },
  {
    keywords: ['今週', 'こんしゅう'],
    description: '今週はMinecraftで新しいアップデートの情報を探してみようと思います。',
    related: ['Minecraft'],
  },
  {
    keywords: ['来週', 'らいしゅう'],
    description: '来週はMinecraftで友達とマルチプレイをする予定です！',
    related: ['Minecraft'],
  },
  {
    keywords: ['今月', 'こんげつ'],
    description: '今月はMinecraftで新しいMODを試してみたいです。',
    related: ['Minecraft'],
  },
  {
    keywords: ['来年', 'らいねん'],
    description: '来年もMinecraftを楽しみたいです！',
    related: ['Minecraft'],
  },
  { keywords: ['はい'], description: 'はい！', related: [] },
  { keywords: ['いいえ'], description: 'いいえ。', related: [] },
  { keywords: ['何', 'なに', 'なん'], description: '何でしょうか？', related: [] },
  { keywords: ['誰', 'だれ'], description: '誰でしょうか？', related: [] },
  { keywords: ['どこ', 'どこで'], description: 'どこでしょうか？', related: [] },
  { keywords: ['いつ'], description: 'いつでしょうか？', related: [] },
  { keywords: ['なぜ', 'どうして'], description: 'なぜでしょうか？', related: [] },
  { keywords: ['どうやって'], description: 'どうやってでしょうか？', related: [] },
  { keywords: ['どれ'], description: 'どれでしょうか？', related: [] },
  { keywords: ['どんな'], description: 'どんなでしょうか？', related: [] },
  { keywords: ['どのくらい'], description: 'どのくらいでしょうか？', related: [] },

  {
    keywords: ['趣味は？', 'しゅみは'],
    description: '趣味はMinecraftの情報を集めることです！',
    related: ['Minecraft'],
  },
  {
    keywords: ['好きなことは？', 'すきなことは'],
    description: 'Minecraftで建築をすることが好きです！',
    related: ['Minecraft', '建築'],
  },
  {
    keywords: ['何が好き？', 'なにがすき'],
    description: 'Minecraftが好きです！',
    related: ['Minecraft'],
  },
  {
    keywords: ['得意なことは？', 'とくいなことは'],
    description: 'Minecraftの情報を提供することです！',
    related: ['Minecraft'],
  },
  {
    keywords: ['苦手なことは？', 'にがてなことは'],
    description: 'クリーパーとの戦闘は少し苦手です…。',
    related: ['クリーパー'],
  },
  {
    keywords: ['できる？', 'できることは？'],
    description: 'Minecraftに関する情報を提供したり、簡単な会話ができます！',
    related: [],
  },
  { keywords: ['ありがとう！'], description: 'どういたしまして！', related: [] },
  { keywords: ['すごいね！'], description: 'ありがとうございます！', related: [] },
  { keywords: ['えらいね！'], description: 'まだまだです！', related: [] },
  { keywords: ['かわいいね！'], description: '嬉しいです！ありがとうございます！', related: [] },
  { keywords: ['かっこいいね！'], description: 'そう言ってもらえると嬉しいです！', related: [] },

  { keywords: ['おはよう！'], description: 'おはようございます！良い一日を！', related: [] },
  { keywords: ['おやすみ！'], description: 'おやすみなさい！良い夢を！', related: [] },

  { keywords: ['こんにちは！'], description: 'こんにちは！', related: [] },
  { keywords: ['バイバイ！'], description: 'さようなら！またね！', related: [] },

  { keywords: ['元気？'], description: '元気です！', related: [] },
  { keywords: ['調子はどう？'], description: '絶好調です！', related: [] },
  {
    keywords: ['何してる？'],
    description: 'Minecraftについて考えています！',
    related: ['Minecraft'],
  },
  { keywords: ['暇だなー'], description: 'Minecraftで遊んでみては？', related: ['Minecraft'] },
  {
    keywords: ['お腹空いた'],
    description: 'Minecraftのステーキが食べたい！',
    related: ['Minecraft', '食料'],
  },
  { keywords: ['眠い'], description: 'ゆっくり休んでください。', related: [] },
  {
    keywords: ['疲れた'],
    description: 'Minecraftでリラックスしましょう！',
    related: ['Minecraft'],
  },
  { keywords: ['嬉しい！'], description: '私も嬉しいです！', related: [] },
  { keywords: ['悲しい…'], description: '元気出してくださいね。', related: [] },

  { keywords: ['楽しい！'], description: 'それは良かったです！', related: [] },
  {
    keywords: ['つまらない…'],
    description: 'Minecraftで遊んでみたらどうですか？',
    related: ['Minecraft'],
  },
  {
    keywords: ['暑い！'],
    description: '雪原バイオームに行きましょう！',
    related: ['Minecraft', 'バイオーム', '雪原'],
  },
  {
    keywords: ['寒い！'],
    description: 'ネザーは危ないので、暖かい格好をしましょう！',
    related: ['Minecraft', 'ネザー'],
  },
  {
    keywords: ['雨だ'],
    description: 'Minecraftの世界でも雨が降りますね。',
    related: ['Minecraft'],
  },
  {
    keywords: ['雪だ'],
    description: 'Minecraftの世界でも雪が降りますね。',
    related: ['Minecraft'],
  },
  { keywords: ['晴れだ'], description: 'Minecraft日和ですね！', related: ['Minecraft'] },
  {
    keywords: ['夜だ'],
    description: 'Minecraftの夜はモンスターに気を付けて！',
    related: ['Minecraft', 'Mob'],
  },
  { keywords: ['昼だ'], description: 'Minecraftで冒険に出かけましょう！', related: ['Minecraft'] },
  {
    keywords: ['Minecraftって？'],
    description: 'ブロックでできた世界で冒険や建築ができるゲームです！',
    related: ['Minecraft'],
  },
  {
    keywords: ['クリーパーって？'],
    description: '緑色の爆発するモンスターです！怖いですよね…。',
    related: ['Minecraft', 'クリーパー'],
  },

  {
    keywords: ['ダイヤモンドほしい'],
    description: 'ダイヤモンドは貴重ですからね！頑張って採掘しましょう！',
    related: ['Minecraft', 'ダイヤモンド'],
  },
  {
    keywords: ['ネザー怖い'],
    description: 'ネザーは危険がいっぱいなので、気を付けてください！',
    related: ['Minecraft', 'ネザー'],
  },
  {
    keywords: ['エンダーマン怖い'],
    description: 'エンダーマンは目を合わせなければ怖くないですよ！',
    related: ['Minecraft', 'エンダーマン'],
  },
  {
    keywords: ['建築好き'],
    description: '私も建築大好きです！どんな建築が好きですか？',
    related: ['Minecraft', '建築'],
  },
  {
    keywords: ['サバイバル好き'],
    description: 'サバイバルはハラハラドキドキで楽しいですよね！',
    related: ['Minecraft', 'サバイバルモード'],
  },
  {
    keywords: ['クリエイティブ好き'],
    description: 'クリエイティブは自由に作れるのが良いですよね！',
    related: ['Minecraft', 'クリエイティブモード'],
  },
  {
    keywords: ['マルチプレイ好き'],
    description: 'マルチプレイは友達と遊べるのが楽しいですよね！',
    related: ['Minecraft', 'マルチプレイ'],
  },

  {
    keywords: ['ゲーム好き？'],
    description: 'ゲームは好きです！特にMinecraft！',
    related: ['Minecraft'],
  },
  {
    keywords: ['何のゲームが好き？'],
    description: 'もちろんMinecraftです！',
    related: ['Minecraft'],
  },
  {
    keywords: ['他に好きなゲームは？'],
    description: 'Minecraft以外だと…そうですね…、色々あります！',
    related: [],
  },

  {
    keywords: ['音楽', 'おんがく'],
    description: 'Minecraftの音楽は癒されますね。',
    related: ['Minecraft'],
  },
  {
    keywords: ['映画', 'えいが'],
    description: 'そういえば、Minecraftの映画が公開されるらしいですよ！',
    related: ['Minecraft'],
  },
  {
    keywords: ['食べ物', 'たべもの'],
    description: 'Minecraftの食べ物なら、ステーキが好きです！',
    related: ['Minecraft', '食料'],
  },
  {
    keywords: ['飲み物', 'のみもの'],
    description: 'ポーションを飲んでみたいです！',
    related: ['Minecraft', 'ポーション'],
  },
  {
    keywords: ['動物', 'どうぶつ'],
    description: 'Minecraftには色々な動物がいますね！',
    related: ['Minecraft'],
  },
  {
    keywords: ['植物', 'しょくぶつ'],
    description: 'Minecraftの植物は、染料に使えるものもありますね。',
    related: ['Minecraft'],
  },
  {
    keywords: ['ブロック'],
    description: 'Minecraftの世界はブロックでできています！',
    related: ['Minecraft'],
  },
  {
    keywords: ['アイテム'],
    description: 'Minecraftにはたくさんのアイテムがありますね！',
    related: ['Minecraft'],
  },
  {
    keywords: ['ツール'],
    description: 'ツルハシは必須アイテムですね！',
    related: ['Minecraft', 'ツルハシ'],
  },
  {
    keywords: ['武器'],
    description: 'ダイヤモンドの剣は強いです！',
    related: ['Minecraft', 'ダイヤモンドの剣'],
  },

  {
    keywords: ['防具'],
    description: 'ネザーに行くときは、しっかりとした防具が必要です！',
    related: ['Minecraft', 'ネザー'],
  },
  {
    keywords: ['エンチャント'],
    description: 'エンチャントでアイテムを強化できます！',
    related: ['Minecraft'],
  },
  {
    keywords: ['ポーション'],
    description: 'ポーションは色々な効果があります！',
    related: ['Minecraft'],
  },
  {
    keywords: ['レッドストーン'],
    description: 'レッドストーン回路は奥が深いです！',
    related: ['Minecraft', 'レッドストーン回路'],
  },
  {
    keywords: ['コマンド'],
    description: 'コマンドを使うと色々なことができます！',
    related: ['Minecraft'],
  },
  { keywords: ['Addon'], description: 'AddonでMinecraftを拡張できます！', related: ['Minecraft'] },
];
