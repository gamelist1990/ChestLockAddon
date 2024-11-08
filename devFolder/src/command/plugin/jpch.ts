import { Player, world } from '@minecraft/server';
import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';

// === 辞書データ ===
interface DictionaryEntry {
  hiragana: string;
  kanji: string;
}

const dictionaryData: DictionaryEntry[] = [
  { kanji: '日本', hiragana: 'にほん' },
  { kanji: '何で', hiragana: 'なんで' },
  { kanji: '知ら', hiragana: 'しら' },
  { kanji: '意味', hiragana: 'いみ' },
  { kanji: '朝', hiragana: 'あさ' },
  { kanji: '大切', hiragana: 'たいせつ' },
  { kanji: '友達', hiragana: 'ともだち' },
  { kanji: '勉強', hiragana: 'べんきょう' },
  { kanji: 'ご飯', hiragana: 'ごはん' },
  { kanji: '仕事', hiragana: 'しごと' },
  { kanji: '電話', hiragana: 'でんわ' },
  { kanji: '水', hiragana: 'みず' },
  { kanji: '日', hiragana: 'にち' },
  { kanji: '月', hiragana: 'つき' },
  { kanji: '星', hiragana: 'ほし' },
  { kanji: '時間', hiragana: 'じかん' },
  { kanji: '先生', hiragana: 'せんせい' },
  { kanji: '学校', hiragana: 'がっこう' },
  { kanji: '空気', hiragana: 'くうき' },
  { kanji: '太陽', hiragana: 'たいよう' },
  { kanji: '星空', hiragana: 'ほしぞら' },
  { kanji: '雨', hiragana: 'あめ' },
  { kanji: '雪', hiragana: 'ゆき' },
  { kanji: '風', hiragana: 'かぜ' },
  { kanji: '海', hiragana: 'うみ' },
  { kanji: '山', hiragana: 'やま' },
  { kanji: '動物', hiragana: 'どうぶつ' },
  { kanji: '魚', hiragana: 'さかな' },
  { kanji: '犬', hiragana: 'いぬ' },
  { kanji: '猫', hiragana: 'ねこ' },
  { kanji: '車', hiragana: 'くるま' },
  { kanji: 'お家', hiragana: 'おうち' },
  { kanji: '', hiragana: 'ひと' },
  { kanji: '男', hiragana: 'おとこ' },
  { kanji: '女', hiragana: 'おんな' },
  { kanji: '子供', hiragana: 'こども' },
  { kanji: '新しい', hiragana: 'あたらしい' },
  { kanji: '面白い', hiragana: 'おもしろい' },
  { kanji: '元気', hiragana: 'げんき' },
  { kanji: '疲れた', hiragana: 'つかれた' },
  { kanji: '美味しい', hiragana: 'おいしい' },
  { kanji: '汚い', hiragana: 'きたない' },
  { kanji: '綺麗', hiragana: 'きれい' },
  { kanji: '強い', hiragana: 'つよい' },
  { kanji: '弱い', hiragana: 'よわい' },
  { kanji: '大きい', hiragana: 'おおきい' },
  { kanji: '小さい', hiragana: 'ちいさい' },
  { kanji: '暑い', hiragana: 'あつい' },
  { kanji: '冷たい', hiragana: 'つめたい' },
  { kanji: '明るい', hiragana: 'あかるい' },
  { kanji: '暗い', hiragana: 'くらいい' },
  { kanji: '古い', hiragana: 'ふるい' },
  { kanji: '楽しい', hiragana: 'たのしい' },
  { kanji: '悲しい', hiragana: 'かなしい' },
  { kanji: '病気', hiragana: 'びょうき' },
  { kanji: '大変', hiragana: 'たいへん' },
  { kanji: '簡単', hiragana: 'かんたん' },
  { kanji: '上手', hiragana: 'じょうず' },
  { kanji: '下手', hiragana: 'へた' },
  { kanji: '早い', hiragana: 'はやい' },
  { kanji: '遅い', hiragana: 'おそい' },
  { kanji: '真っ直ぐ', hiragana: 'まっすぐ' },
  { kanji: '曲がった', hiragana: 'まがった' },
  { kanji: '寒い', hiragana: 'さむい' },
  { kanji: '汚れ', hiragana: 'よごれ' },
  { kanji: '可愛い', hiragana: 'かわいい' },
  { kanji: '優しい', hiragana: 'やさしい' },
  { kanji: '厳しい', hiragana: 'きびしい' },
  { kanji: '静か', hiragana: 'しずか' },
  { kanji: 'うるさい', hiragana: 'うるさい' },
  { kanji: 'まずい', hiragana: 'まずい' },
  { kanji: '甘い', hiragana: 'あまい' },
  { kanji: '酸っぱい', hiragana: 'すっぱい' },
  { kanji: '辛い', hiragana: 'からい' },
  { kanji: '苦い', hiragana: 'にがい' },
  { kanji: '温かい', hiragana: 'あたたかい' },
  { kanji: '多い', hiragana: 'おおい' },
  { kanji: '少ない', hiragana: 'すくない' },
  { kanji: '難しい', hiragana: 'むずかしい' },
  { kanji: '私', hiragana: 'わたし' },
  { kanji: '歩く', hiragana: 'あるく' },
  { kanji: '食べ', hiragana: 'たべ' },
  { kanji: '寝る', hiragana: 'ねる' },
  { kanji: '見る', hiragana: 'みる' },
  { kanji: '聞く', hiragana: 'きく' },
  { kanji: '話す', hiragana: 'はなす' },
  { kanji: '読む', hiragana: 'よむ' },
  { kanji: '書く', hiragana: 'かく' },
  { kanji: '行く', hiragana: 'いく' },
  { kanji: '来る', hiragana: 'くる' },
  { kanji: '分かる', hiragana: 'わかる' },
  { kanji: '出来る', hiragana: 'できる' },
  { kanji: '好き', hiragana: 'すき' },
  { kanji: '嫌い', hiragana: 'きらい' },
  { kanji: '欲しい', hiragana: 'ほしい' },
  //ゲーム
  { kanji: '攻略', hiragana: 'こうりゃく' },
  { kanji: 'レベル', hiragana: 'れべる' },
  { kanji: 'アイテム', hiragana: 'あいてむ' },
  { kanji: 'スキル', hiragana: 'すきる' },
  { kanji: 'クエスト', hiragana: 'くえすと' },
  { kanji: 'パーティー', hiragana: 'ぱーてぃー' },
  { kanji: 'ボス', hiragana: 'ぼす' },
  { kanji: 'ダンジョン', hiragana: 'だんじょん' },
  { kanji: '経験値', hiragana: 'けいけんち' },
  { kanji: 'ダメージ', hiragana: 'だめーじ' },
  { kanji: '回復', hiragana: 'かいふく' },
  { kanji: '魔法', hiragana: 'まほう' },

  // 中級・上級・日常会話
  { kanji: '想像', hiragana: 'そうぞう' },
  { kanji: '創造', hiragana: 'そうぞう' },
  { kanji: '解決', hiragana: 'かいけつ' },
  { kanji: '影響', hiragana: 'えいきょう' },
  { kanji: '社会', hiragana: 'しゃかい' },
  { kanji: '経済', hiragana: 'けいざい' },
  { kanji: '政治', hiragana: 'せいじ' },
  { kanji: '文化', hiragana: 'ぶんか' },
  { kanji: '歴史', hiragana: 'れきし' },
  { kanji: '環境', hiragana: 'かんきょう' },
  { kanji: '技術', hiragana: 'ぎじゅつ' },
  { kanji: '情報', hiragana: 'じょうほう' },
  { kanji: '教育', hiragana: 'きょういく' },
  { kanji: '医療', hiragana: 'いりょう' },
  { kanji: '旅行', hiragana: 'りょこう' },
  { kanji: '食事', hiragana: 'しょくじ' },
  { kanji: '趣味', hiragana: 'しゅみ' },
  { kanji: '将来', hiragana: 'しょうらい' },
  { kanji: '約束', hiragana: 'やくそく' },
  { kanji: '準備', hiragana: 'じゅんび' },
  { kanji: '心配', hiragana: 'しんぱい' },
  { kanji: '頑張る', hiragana: 'がんばる' },
  { kanji: '手伝う', hiragana: 'てつだう' },
  { kanji: '楽しむ', hiragana: 'たのしむ' },
  { kanji: '理解', hiragana: 'りかい' },
  { kanji: '説明する', hiragana: 'せつめいする' },
  //Minecraft

  { kanji: 'ブロック', hiragana: 'ぶろっく' },
  { kanji: '鉱石', hiragana: 'こうせき' },
  { kanji: 'クラフト', hiragana: 'くらふと' },
  { kanji: 'クリーパー', hiragana: 'くりーぱー' },
  { kanji: 'ゾンビ', hiragana: 'ぞんび' },
  { kanji: 'スケルトン', hiragana: 'すけるとん' },
  { kanji: 'エンダーマン', hiragana: 'えんだーまん' },
  { kanji: 'ネザー', hiragana: 'ねざー' },
  { kanji: 'エンドラ', hiragana: 'えんどら' },
  { kanji: 'エンド', hiragana: 'えんど' },
  { kanji: 'ポーション', hiragana: 'ぽーしょん' },
  { kanji: 'エンチャント', hiragana: 'えんちゃんとする' },
  { kanji: 'レッドストーン', hiragana: 'れっどすとーん' },
  { kanji: 'ダイヤ', hiragana: 'だいや' },
  { kanji: '鉄', hiragana: 'てつ' },
  { kanji: '金', hiragana: 'きん' },
  { kanji: '村人', hiragana: 'むらびと' },
  { kanji: 'サバイバル', hiragana: 'さばいばる' },
  { kanji: 'クリエイティブ', hiragana: 'くりえいてぃぶ' },
  { kanji: 'トライアルジャンバー', hiragana: 'とらいあるじゃんばー' },
  { kanji: 'エンダードラゴン', hiragana: 'えんだーどらごん' },
  { kanji: 'ウィザー', hiragana: 'うぃざー' },
  { kanji: '古代の残骸', hiragana: 'こだいのざんがい' },
  { kanji: 'ネザライト', hiragana: 'ねざらいと' },
  { kanji: 'ビーコン', hiragana: 'びーこん' },
  { kanji: 'コンジット', hiragana: 'こんじっと' },
  { kanji: 'シュルカーボックス', hiragana: 'しゅるかーぼっくす' },
  { kanji: 'エリトラ', hiragana: 'えりとら' },
  { kanji: 'エンダーパール', hiragana: 'えんだーぱーる' },
  { kanji: '醸造台', hiragana: 'じょうぞうだい' },
  { kanji: 'かまど', hiragana: 'かまど' },
  { kanji: '作業台', hiragana: 'さぎょうだい' },
  { kanji: 'エンチャントテーブル', hiragana: 'えんちゃんとするてーぶる' },
  { kanji: '村', hiragana: 'むら' },
  { kanji: '要塞', hiragana: 'ようさい' },
  { kanji: '寺院', hiragana: 'じいん' },
  { kanji: '海底神殿', hiragana: 'かいていしんでん' },
  { kanji: '森の洋館', hiragana: 'もりのようかん' },
  { kanji: 'ピストン', hiragana: 'ぴすとん' },
  { kanji: 'オブザーバー', hiragana: 'おぶざーばー' },
  { kanji: 'レッドストーンリピーター', hiragana: 'れっどすとーんりぴーたー' },
  { kanji: 'レッドストーンコンパレーター', hiragana: 'れっどすとーんこんぱれーたー' },
  { kanji: 'ホッパー', hiragana: 'ほっぱー' },
  { kanji: 'ドロッパー', hiragana: 'どろっぱー' },
  { kanji: 'ディスペンサー', hiragana: 'でぃすぺんさー' },
  { kanji: 'TNT', hiragana: 'てぃーえぬてぃー' },
  { kanji: 'レール', hiragana: 'れーる' },
  { kanji: 'トロッコ', hiragana: 'とろっこ' },
  { kanji: 'ボート', hiragana: 'ぼーと' },
  { kanji: '馬', hiragana: 'うま' },
  { kanji: '豚', hiragana: 'ぶた' },
  { kanji: '羊', hiragana: 'ひつじ' },
  { kanji: '鶏', hiragana: 'にわとり' },
  { kanji: 'オオカミ', hiragana: 'おおかみ' },
  { kanji: '猫', hiragana: 'ねこ' },
  { kanji: 'パンダ', hiragana: 'ぱんだ' },
  { kanji: 'キツネ', hiragana: 'きつね' },
  { kanji: 'ウサギ', hiragana: 'うさぎ' },
  { kanji: 'カメ', hiragana: 'かめ' },
  { kanji: '魚', hiragana: 'さかな' },
  { kanji: 'タツノオトシゴ', hiragana: 'たつのおとしご' },
  { kanji: 'イルカ', hiragana: 'いるか' },
  { kanji: 'ホッキョクグマ', hiragana: 'ほっきょくぐま' },
  { kanji: 'ラマ', hiragana: 'らま' },
  { kanji: 'ハチ', hiragana: 'はち' },
  { kanji: 'アレイ', hiragana: 'あれい' },
  { kanji: '石', hiragana: 'いし' },
  { kanji: '土', hiragana: 'つち' },
  { kanji: '砂', hiragana: 'すな' },
  { kanji: '砂利', hiragana: 'じゃり' },
  { kanji: '花', hiragana: 'はな' },
  { kanji: 'キノコ', hiragana: 'きのこ' },
  { kanji: 'サトウキビ', hiragana: 'さとうきび' },
  { kanji: 'カボチャ', hiragana: 'かぼちゃ' },
  { kanji: 'スイカ', hiragana: 'すいか' },
  { kanji: '小麦', hiragana: 'こむぎ' },
  { kanji: 'ニンジン', hiragana: 'にんじん' },
  { kanji: 'ジャガイモ', hiragana: 'じゃがいも' },
  { kanji: 'ビートルート', hiragana: 'びーとるーと' },
  { kanji: 'オーク', hiragana: 'おーく' },
  { kanji: 'シラカバ', hiragana: 'しらかば' },
  { kanji: '黒曜石', hiragana: 'こくようせき' },
  { kanji: 'グローストーン', hiragana: 'ぐろーすとーん' },
  { kanji: 'クォーツ', hiragana: 'くぉーつ' },
  { kanji: 'ネザーウォート', hiragana: 'ねざーうぉーと' },
  { kanji: 'ソウルサンド', hiragana: 'そうるさんど' },
  { kanji: 'マグマブロック', hiragana: 'まぐまぶろっく' },
  { kanji: 'ネザーラック', hiragana: 'ねざーらっく' },
  { kanji: 'グロウストーンダスト', hiragana: 'ぐろーすとーんだすと' },
  { kanji: 'エメラルド', hiragana: 'えめらるど' },
  { kanji: 'アイアンゴーレム', hiragana: 'あいあんごーれむ' },
  { kanji: '石炭', hiragana: 'せきたん' },
  { kanji: 'ネザゲ', hiragana: 'ねざげ' },
  { kanji: '方仮名', hiragana: 'かたがな' },

  //色々~
  { kanji: '大体', hiragana: 'だいたい' },
  { kanji: 'ローマ字', hiragana: 'ろ-まじ' },
  { kanji: '対応', hiragana: 'たいおう' },
  { kanji: 'ベータ', hiragana: 'べ-た' },
  { kanji: '必要', hiragana: 'ひつよう' },
  { kanji: '広告', hiragana: 'こうこく' },
  { kanji: '見た', hiragana: 'みた' },
  { kanji: '色々', hiragana: 'いろいろ' },
  { kanji: '追加', hiragana: 'ついか' },
  { kanji: '洞窟', hiragana: 'どうくつ' },
  { kanji: '掘る', hiragana: 'ほる' },
  { kanji: '掘り', hiragana: '掘り' },
  { kanji: '探', hiragana: 'さが' },
  { kanji: '暇', hiragana: 'ひま' },
  { kanji: '自由', hiragana: 'じゆう' },
  { kanji: '沢山', hiragana: 'たくさん' },
  { kanji: '世界', hiragana: 'せかい' },
  { kanji: '問題', hiragana: 'もんだい' },
  { kanji: 'していくよ', hiragana: 'していくよ' },
  { kanji: '不足', hiragana: 'していくよ' },
  { kanji: '日本語', hiragana: 'にほんご' },
  { kanji: '英語', hiragana: 'えいご' },
  { kanji: '変換', hiragana: 'へんかん' },
  { kanji: '人', hiragana: 'びと' },
  { kanji: '後々', hiragana: 'のちのち' },
  { kanji: '辞書', hiragana: 'じしょ' },
  { kanji: '登録', hiragana: 'とうろく' },
  { kanji: '一部', hiragana: 'いちぶ' },
  { kanji: '人間', hiragana: 'にんげん' },
  { kanji: '何', hiragana: 'なに' },
  { kanji: '後は', hiragana: 'あとは' },
  { kanji: '今', hiragana: 'いま' },
  { kanji: 'ローマ字', hiragana: 'ろーまじ' },
  { kanji: '機能', hiragana: 'きのう' },
  { kanji: '実験', hiragana: 'じっけん' },
  { kanji: '炙り', hiragana: 'あぶり' },
  { kanji: 'ディスコード', hiragana: 'でぃすこーど' },
  { kanji: '不正行為', hiragana: 'ふせいこうい' },
  { kanji: '荒らし', hiragana: 'あらし' },
  { kanji: '抜けた', hiragana: 'ぬけた' },
  { kanji: '抜ける', hiragana: 'ぬける' },
  { kanji: '分後', hiragana: 'ぷんご' },
  { kanji: '相談', hiragana: 'そうだん' },
  { kanji: '相談所', hiragana: 'そうだんじょ' },
  { kanji: '修正', hiragana: 'しゅうせい' },
  { kanji: '発見', hiragana: 'はっけん' },
  { kanji: '場所', hiragana: 'ばしょ' },
  { kanji: '少し', hiragana: 'すこし' },
  { kanji: '直し', hiragana: 'なおし' },
  { kanji: '寝る', hiragana: 'ねる' },
  { kanji: '寝よ', hiragana: 'ねよ' },
  { kanji: '主', hiragana: 'あるじ' },
  { kanji: '主', hiragana: 'ぬし' },
  { kanji: '更新', hiragana: 'こうしん' },
  { kanji: '牛', hiragana: 'うし' },
  { kanji: 'どうし', hiragana: 'どうし' },
  { kanji: 'サポート', hiragana: 'さぽーと' },
  { kanji: '部分', hiragana: 'ぶぶん' },
  { kanji: '上手く', hiragana: 'うまく' },
  { kanji: '囲む', hiragana: 'かこむ' },
  { kanji: '囲ん', hiragana: 'かこん' },
  { kanji: '囲んで', hiragana: 'かこんで' },
  { kanji: '無効', hiragana: 'むこう' },
  { kanji: '引数', hiragana: 'ひきすう' },
  { kanji: '感激', hiragana: 'かんげき' },
  { kanji: '復元', hiragana: 'ふくげん' },
  { kanji: '現代', hiragana: 'げんだい' },
  { kanji: 'アート', hiragana: 'あーと' },
  { kanji: 'こっち来て', hiragana: 'こっちきて' },
  { kanji: '興味', hiragana: 'きょうみ' },
  { kanji: '意味深', hiragana: 'いみしん' },
  { kanji: 'バグ', hiragana: 'ばぐ' },
  { kanji: '鯖', hiragana: 'さば' },
  { kanji: 'サーバー', hiragana: 'さーばー' },
  { kanji: '何故に', hiragana: 'なぜに' },
  { kanji: '良く分から', hiragana: 'よくわから' },
  { kanji: '冗談', hiragana: 'じょうだん' },
  { kanji: '暗殺', hiragana: 'あんさつ' },
  { kanji: '批判', hiragana: 'ひはん' },
  { kanji: '革命', hiragana: 'かくめい' },
  { kanji: '英語', hiragana: 'えいご' },
  { kanji: '我', hiragana: 'われ' },
  { kanji: '最新', hiragana: 'さいしん' },
  { kanji: '発展', hiragana: 'はってん' },
  { kanji: '発表', hiragana: 'はっぴょう' },
  { kanji: '次', hiragana: 'つぎ' },
  { kanji: '危険', hiragana: 'きけん' },
  { kanji: '原因', hiragana: 'げんいん' },
  { kanji: '電池', hiragana: 'でんち' },
  { kanji: '国', hiragana: 'くに' },
  { kanji: '利用', hiragana: 'りよう' },
  { kanji: 'まな板', hiragana: 'まないた' },
  { kanji: '新機能', hiragana: 'しんきのう' },
  { kanji: 'カスタマイズ', hiragana: 'かすたまいず' },
  { kanji: 'アプリ', hiragana: 'あぷり' },
  { kanji: 'アップ', hiragana: 'あっぷ' },
  { kanji: '自由度', hiragana: 'じゆうど' },
  { kanji: 'テスト', hiragana: 'てすと' },
  { kanji: 'ロマン', hiragana: 'ろまん' },
  { kanji: 'アニメ', hiragana: 'あにめ' },
  { kanji: 'コーヒー', hiragana: 'こーひー' },
  { kanji: 'ディスプレイ', hiragana: 'でぃすぷれい' },
  { kanji: 'コメント', hiragana: 'こめんと' },
  { kanji: 'モザイク', hiragana: 'もざいく' },
  { kanji: '宿泊', hiragana: 'しゅくはく' },
  { kanji: '修繕', hiragana: 'しゅうぜん' },
  { kanji: 'ドイツ', hiragana: 'どいつ' },
  { kanji: '帝国', hiragana: 'ていこく' },
  { kanji: '生活', hiragana: 'せいかつ' },
  { kanji: '方が', hiragana: 'ほうが' },
  { kanji: '一応', hiragana: 'いちおう' },
  { kanji: '座標', hiragana: 'ざひょう' },
];

const dictionary: { [key: string]: string[] } = {};
dictionaryData.forEach(({ kanji, hiragana }) => {
  if (!dictionary[hiragana]) {
    dictionary[hiragana] = [];
  }
  dictionary[hiragana].push(kanji);
});

// === ローマ字変換テーブル ===
const conversionTable: { [key: string]: string[] } = {
  // Basic Hiragana
  a: ['あ', 'ア', 'a'],
  i: ['い', 'イ', 'i'],
  u: ['う', 'ウ', 'u'],
  e: ['え', 'エ', 'e'],
  o: ['お', 'オ', 'o'],
  ka: ['か', 'カ', 'ka'],
  ki: ['き', 'キ', 'ki'],
  ku: ['く', 'ク', 'ku'],
  ke: ['け', 'ケ', 'ke'],
  ko: ['こ', 'コ', 'ko'],
  sa: ['さ', 'サ', 'sa'],
  si: ['し', 'シ', 'si'],
  su: ['す', 'ス', 'su'],
  se: ['せ', 'セ', 'se'],
  so: ['そ', 'ソ', 'so'],
  ta: ['た', 'タ', 'ta'],
  ti: ['ち', 'チ', 'ti'],
  tu: ['つ', 'ツ', 'tu'],
  te: ['て', 'テ', 'te'],
  to: ['と', 'ト', 'to'],
  na: ['な', 'ナ', 'na'],
  ni: ['に', 'ニ', 'ni'],
  nu: ['ぬ', 'ヌ', 'nu'],
  ne: ['ね', 'ネ', 'ne'],
  no: ['の', 'ノ', 'no'],
  ha: ['は', 'ハ', 'ha'],
  hi: ['ひ', 'ヒ', 'hi'],
  hu: ['ふ', 'フ', 'hu'],
  he: ['へ', 'ヘ', 'he'],
  ho: ['ほ', 'ホ', 'ho'],
  ma: ['ま', 'マ', 'ma'],
  mi: ['み', 'ミ', 'mi'],
  mu: ['む', 'ム', 'mu'],
  me: ['め', 'メ', 'me'],
  mo: ['も', 'モ', 'mo'],
  ya: ['や', 'ヤ', 'ya'],
  yu: ['ゆ', 'ユ', 'yu'],
  yo: ['よ', 'ヨ', 'yo'],
  ra: ['ら', 'ラ', 'ra'],
  ri: ['り', 'リ', 'ri'],
  ru: ['る', 'ル', 'ru'],
  re: ['れ', 'レ', 're'],
  ro: ['ろ', 'ロ', 'ro'],
  wa: ['わ', 'ワ', 'wa'],
  wo: ['を', 'ヲ', 'wo'],
  nn: ['ん', 'ン', 'nn'],

  // "G" sounds
  ga: ['が', 'ガ', 'ga'],
  gi: ['ぎ', 'ギ', 'gi'],
  gu: ['ぐ', 'グ', 'gu'],
  ge: ['げ', 'ゲ', 'ge'],
  go: ['ご', 'ゴ', 'go'],

  // "Z" sounds
  za: ['ざ', 'ザ', 'za'],
  ji: ['じ', 'ジ', 'ji'],
  zi: ['じ', 'ジ', 'zi'],
  zu: ['ず', 'ズ', 'zu'],
  ze: ['ぜ', 'ゼ', 'ze'],
  zo: ['ぞ', 'ゾ', 'zo'],

  // "D" sounds
  da: ['だ', 'ダ', 'da'],
  di: ['ぢ', 'ヂ', 'di'],
  du: ['づ', 'ヅ', 'du'],
  de: ['で', 'デ', 'de'],
  do: ['ど', 'ド', 'do'],

  // "B" sounds
  ba: ['ば', 'バ', 'ba'],
  bi: ['び', 'ビ', 'bi'],
  bu: ['ぶ', 'ブ', 'bu'],
  be: ['べ', 'ベ', 'be'],
  bo: ['ぼ', 'ボ', 'bo'],

  // "P" sounds
  pa: ['ぱ', 'パ', 'pa'],
  pi: ['ぴ', 'ピ', 'pi'],
  pu: ['ぷ', 'プ', 'pu'],
  pe: ['ぺ', 'ペ', 'pe'],
  po: ['ぽ', 'ポ', 'po'],

  // "K" sounds with "ya", "yu", "yo"
  kya: ['きゃ', 'キャ', 'kya'],
  kyu: ['きゅ', 'キュ', 'kyu'],
  kyo: ['きょ', 'キョ', 'kyo'],
  kye: ['きぇ', 'シェ', 'kye'],

  // "S" sounds with "ya", "yu", "yo"
  sya: ['しゃ', 'シャ', 'sya'],
  syu: ['しゅ', 'シュ', 'syu'],
  syo: ['しょ', 'ショ', 'syo'],
  sye: ['しぇ', 'シェ', 'sye'],

  // "Ch" sounds with "ya", "yu", "yo"
  cha: ['ちゃ', 'チャ', 'cha'],
  chu: ['ちゅ', 'チュ', 'chu'],
  cho: ['ちょ', 'チョ', 'cho'],
  che: ['ちぇ', 'チョ', 'che'],

  // "N" sounds with "ya", "yu", "yo"
  nya: ['にゃ', 'ニャ', 'nya'],
  nyu: ['にゅ', 'ニュ', 'nyu'],
  nyo: ['にょ', 'ニョ', 'nyo'],
  nye: ['にぇ', 'ニェ', 'nye'],

  // "H" sounds with "ya", "yu", "yo"
  hya: ['ひゃ', 'ヒャ', 'hya'],
  hyu: ['ひゅ', 'ヒュ', 'hyu'],
  hyo: ['ひょ', 'ヒョ', 'hyo'],
  hye: ['ひぇ', 'ヒェ', 'hye'],

  // "M" sounds with "ya", "yu", "yo"
  mya: ['みゃ', 'ミャ', 'mya'],
  myu: ['みゅ', 'ミュ', 'myu'],
  myo: ['みょ', 'ミョ', 'myo'],
  mye: ['みぇ', 'ミェ', 'mye'],

  // "R" sounds with "ya", "yu", "yo"
  rya: ['りゃ', 'リャ', 'rya'],
  ryu: ['りゅ', 'リュ', 'ryu'],
  ryo: ['りょ', 'リョ', 'ryo'],
  rye: ['りぇ', 'リェ', 'rye'],

  // "G" sounds with "ya", "yu", "yo"
  gya: ['ぎゃ', 'ギャ', 'gya'],
  gyu: ['ぎゅ', 'ギュ', 'gyu'],
  gyo: ['ぎょ', 'ギョ', 'gyo'],
  gye: ['ぎぇ', 'ギェ', 'gye'],

  // "J" sounds with "ya", "yu", "yo"
  ja: ['じゃ', 'ジャ', 'ja'],
  je: ['じぇ', 'ジャ', 'je'],
  ju: ['じゅ', 'ジュ', 'ju'],
  jo: ['じょ', 'ジョ', 'jo'],

  // "B" sounds with "ya", "yu", "yo"
  bya: ['びゃ', 'ビャ', 'bya'],
  byu: ['びゅ', 'ビュ', 'byu'],
  byo: ['びょ', 'ビョ', 'byo'],
  bye: ['びぇ', 'ビェ', 'bye'],

  // "P" sounds with "ya", "yu", "yo"
  pya: ['ぴゃ', 'ピャ', 'pya'],
  pyu: ['ぴゅ', 'ピュ', 'pyu'],
  pyo: ['ぴょ', 'ピョ', 'pyo'],
  pye: ['ぴぇ', 'ピェ', 'pye'],

  // Double Consonant Sounds (before 'k' sounds)
  kka: ['っか', 'null'],
  kki: ['っき', 'null'],
  kku: ['っく', 'null'],
  kke: ['っけ', 'null'],
  kko: ['っこ', 'null'],

  ssa: ['っさ', 'null'],
  ssi: ['っし', 'null'],
  ssu: ['っす', 'null'],
  sse: ['っせ', 'null'],
  sso: ['っそ', 'null'],

  tta: ['った', 'null'],
  tti: ['っち', 'null'],
  ttu: ['っつ', 'null'],
  tte: ['って', 'null'],
  tto: ['っと', 'null'],
  tye: ['ちぇ', 'null'],



  // Custom

  fi: ['ふぃ', 'フィ', 'fi'],
  fe: ['ふぇ', 'フィ', 'fi'],
  fo: ['ふぉ', 'フィ', 'fi'],
  xi: ['ぃ', 'イ', 'xi'],
  li: ['ぃ', 'イ', 'li'],
  ltu: ['っ', 'イ', 'ltu'],
  xtu: ['っ', 'イ', 'xtu'],
  xa: ['ぁ', 'ァ', 'xa'],
  le: ['ぇ', 'ェ', 'le'],
  xe: ['ぇ', 'ェ', 'xe'],
  lu: ['ぅ', 'ゥ', 'lu'],
  xu: ['ぅ', 'ゥ', 'xu'],

  // Long Sound Mark
  '-': ['ー', 'ー', '-'],
  '!': ['！', '！', '!'],
  '?': ['？', '？', '!'],
};

// === ローマ字からひらがなへの変換 ===
function romajiToHiragana(romaji: string): string {
  let result = '';
  let i = 0;
  while (i < romaji.length) {
    if (i < romaji.length - 2 && conversionTable[romaji.substring(i, i + 3)]) {
      result += conversionTable[romaji.substring(i, i + 3)][0];
      i += 3;
    } else if (i < romaji.length - 1 && conversionTable[romaji.substring(i, i + 2)]) {
      result += conversionTable[romaji.substring(i, i + 2)][0];
      i += 2;
    } else if (conversionTable[romaji[i]]) {
      result += conversionTable[romaji[i]][0];
      i++;
    } else {
      result += romaji[i];
      i++;
    }
  }
  return result;
}

function splitIntoWords(text: string): string[] {
  const words: string[] = [];
  let currentWord = '';
  let i = 0;

  while (i < text.length) {
    let longestMatch = '';
    for (const word in dictionary) {
      if (text.substring(i, i + word.length) === word && word.length > longestMatch.length) {
        longestMatch = word;
      }
    }

    if (longestMatch) {
      if (currentWord) {
        words.push(currentWord);
        currentWord = '';
      }
      words.push(longestMatch);
      i += longestMatch.length;
    } else {
      currentWord += text[i];
      i++;
    }
  }

  if (currentWord) {
    words.push(currentWord);
  }

  return words;
}

// === ひらがなから漢字への変換 (最長一致検索) ===
function hiraganaToKanji(hiraganaText: string): string {
  const words = splitIntoWords(hiraganaText);
  let result = '';
  for (const word of words) {
    if (dictionary[word]) {
      const sortedEntries = dictionary[word].sort((a, b) => b.length - a.length);
      result += sortedEntries[0]; 
    } else {
      result += word;
    }
  }
  return result;
}

// === ローマ字変換関数 (修正版) ===
function convertRomajiToJapanese(romaji: string): string {
  if (romaji.startsWith('!')) {
    return romaji;
  }

  let result = '';
  let insideQuotes = false;
  let currentSegment = '';

  for (let i = 0; i < romaji.length; i++) {
    if (romaji[i] === '"') {
      if (insideQuotes) {
        result += '"' + currentSegment + '"';
        currentSegment = '';
      } else {
        result += convertSegment(currentSegment);
        currentSegment = '';
      }
      insideQuotes = !insideQuotes;
    } else {
      currentSegment += romaji[i];
    }
  }

  if (currentSegment) {
    result += insideQuotes ? currentSegment : convertSegment(currentSegment);
  }

  return result;
}

function convertSegment(segment: string): string {
  const hiraganaText = romajiToHiragana(segment);
  const kanjiText = hiraganaToKanji(hiraganaText);
  return kanjiText;
}

let romajiConversionEnabled = false;
const playerConversionStatus = new Map<Player, boolean>();

//@ts-ignore
world.beforeEvents.chatSend.subscribe((event: any) => {
  const player = event.sender;
  if (!(player instanceof Player)) return;

  const isEnabled = playerConversionStatus.get(player) ?? romajiConversionEnabled;

  if (isEnabled && !event.message.startsWith('!')) {
    const originalMessage = event.message;
    const convertedMessage = convertRomajiToJapanese(originalMessage);

    event.cancel = true;
    world.sendMessage(`<${player.name}> ${originalMessage} §6(${convertedMessage})`);
  }
});

registerCommand({
  name: 'jpch',
  description: 'jpch_docs',
  parent: false,
  maxArgs: 1,
  minArgs: 1,
  require: (player: Player) => verifier(player, config().commands['jpch']),
  executor: (player: Player, args: string[]) => {
    const input = args[0];

    if (input === '-true') {
      playerConversionStatus.set(player, true);
      player.sendMessage('§aローマ字変換が有効になりました。');
    } else if (input === '-false') {
      playerConversionStatus.set(player, false);
      player.sendMessage('§cローマ字変換が無効になりました。');
    } else {
      player.sendMessage("§c無効な引数です。 '-true' または '-false' を指定してください。");
    }
  },
});
