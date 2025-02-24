interface TrieNode {
    children: { [key: string]: TrieNode };
    entry?: WordEntry[];
}

interface WordEntry {
    kanji: string;
    hiragana: string;
    priority: number;
}


export class RomajiKanjiConverter {
    private romajiToHiragana: { [key: string]: string } = {
        a: "あ", i: "い", u: "う", e: "え", o: "お",
        ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
        sa: "さ", shi: "し", su: "す", se: "せ", so: "そ",
        ta: "た", chi: "ち", tsu: "つ", te: "て", to: "と", tu: "つ",
        na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
        ha: "は", hi: "ひ", fu: "ふ", he: "へ", ho: "ほ", hu: "ふ",
        ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
        ya: "や", yu: "ゆ", yo: "よ",
        ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
        wa: "わ", wo: "を", n: "ん", nn: "ん",

        // 濁音
        ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
        za: "ざ", ji: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
        da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
        ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",

        // 半濁音
        pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",

        // 拗音
        kya: "きゃ", kyu: "きゅ", kyo: "きょ",
        sha: "しゃ", shu: "しゅ", sho: "しょ", syo: "しょ",
        cha: "ちゃ", chu: "ちゅ", cho: "ちょ", cyo: "ちょ",
        nya: "にゃ", nyu: "にゅ", nyo: "にょ",
        hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
        mya: "みゃ", myu: "みゅ", myo: "みょ",
        rya: "りゃ", ryu: "りょ", ryo: "りょ",
        gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
        ja: "じゃ", ju: "じゅ", jo: "じょ", jyu: "じゅ", jyo: "じょ",
        bya: "びゃ", byu: "びょ", byo: "びょ",
        pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",

        // その他
        vu: "ヴ", va: "ヴァ", vi: "ヴィ", ve: "ヴェ", vo: "ヴォ",

        // ヘボン式 (対応)
        si: "し", // shの代わり
        zi: "じ", // jの代わり
        // 小さい文字
        la: "ぁ", li: "ぃ", lu: "ぅ", le: "ぇ", lo: "ぉ",
        xa: "ぁ", xi: "ぃ", xu: "ぅ", xe: "ぇ", xo: "ぉ",
        // 促音 (対応)
        ltu: "っ", xtu: "っ",  // ltuとxtuの対応
        xtsu: "っ", //xtsuの対応　
        xtuxtu: "っっ",
        // 特殊な対応 (例: IMEで変換できない small ka, small ke)
        xka: "ゕ",
        xke: "ヶ",


        // n の特殊な対応 (例: shin'ya -> しんや)
        "n'": "ん",

        //重ね文字
        kka: "っか", kki: "っき", kku: "っく", kke: "っけ", kko: "っこ",
        ssa: "っさ", ssi: "っし", ssu: "っす", sse: "っせ", sso: "っそ", ssha: "っしゃ", ssho: "っしょ",
        tta: "った", tti: "っち", ttsu: "っつ", tte: "って", tto: "っと",
        ppa: "っぱ", ppi: "っぴ", ppu: "っぷ", ppe: "っぺ", ppo: "っぽ",
    };

    private trieRoot: TrieNode; // トライ木のルートノード
    private dictionary: { [key: string]: WordEntry[] };


    // static なファクトリーメソッドを作成
    static async create(initialDictionary?: { [key: string]: WordEntry[] }): Promise<RomajiKanjiConverter> {
        const converter = new RomajiKanjiConverter(initialDictionary);
        await converter.initialize(); // 初期化処理をここで行う
        return converter;
    }

    // private な初期化メソッド（コンストラクタから分離）
    private async initialize() {
        this.loadDictionaryToTrie(); // 既存の辞書、初期辞書をまとめて読み込む
    }

    //コンストラクタはprivate
    private constructor(initialDictionary?: { [key: string]: WordEntry[] }) {
        this.trieRoot = { children: {} }; // 初期化
        this.dictionary = initialDictionary || {
            "810": [
                {
                    "kanji": "野獣",
                    "hiragana": "810",
                    "priority": 1
                }
            ],
            "わたし": [
                {
                    "kanji": "私",
                    "hiragana": "わたし",
                    "priority": 3
                }
            ],
            "あなた": [
                {
                    "kanji": "あなた",
                    "hiragana": "あなた",
                    "priority": 3
                }
            ],
            "かのじょ": [
                {
                    "kanji": "彼女",
                    "hiragana": "かのじょ",
                    "priority": 3
                }
            ],
            "いぬ": [
                {
                    "kanji": "犬",
                    "hiragana": "いぬ",
                    "priority": 3
                }
            ],
            "ねこ": [
                {
                    "kanji": "猫",
                    "hiragana": "ねこ",
                    "priority": 3
                }
            ],
            "たべる": [
                {
                    "kanji": "食べる",
                    "hiragana": "たべる",
                    "priority": 3
                }
            ],
            "のむ": [
                {
                    "kanji": "飲む",
                    "hiragana": "のむ",
                    "priority": 3
                }
            ],
            "みる": [
                {
                    "kanji": "見る",
                    "hiragana": "みる",
                    "priority": 3
                }
            ],
            "きく": [
                {
                    "kanji": "聞く",
                    "hiragana": "きく",
                    "priority": 3
                }
            ],
            "いく": [
                {
                    "kanji": "行く",
                    "hiragana": "いく",
                    "priority": 3
                }
            ],
            "くる": [
                {
                    "kanji": "来る",
                    "hiragana": "くる",
                    "priority": 3
                }
            ],
            "かわいい": [
                {
                    "kanji": "可愛い",
                    "hiragana": "かわいい",
                    "priority": 3
                }
            ],
            "うれしい": [
                {
                    "kanji": "嬉しい",
                    "hiragana": "うれしい",
                    "priority": 3
                }
            ],
            "たのしい": [
                {
                    "kanji": "楽しい",
                    "hiragana": "たのしい",
                    "priority": 3
                }
            ],
            "おもしろい": [
                {
                    "kanji": "面白い",
                    "hiragana": "おもしろい",
                    "priority": 3
                }
            ],
            "ねむい": [
                {
                    "kanji": "眠い",
                    "hiragana": "ねむい",
                    "priority": 3
                }
            ],
            "おはよう": [
                {
                    "kanji": "おはよう",
                    "hiragana": "おはよう",
                    "priority": 5
                }
            ],
            "こんばんは": [
                {
                    "kanji": "こんばんは",
                    "hiragana": "こんばんは",
                    "priority": 5
                }
            ],
            "さようなら": [
                {
                    "kanji": "さようなら",
                    "hiragana": "さようなら",
                    "priority": 5
                }
            ],
            "ありがとう": [
                {
                    "kanji": "ありがとう",
                    "hiragana": "ありがとう",
                    "priority": 5
                }
            ],
            "すみません": [
                {
                    "kanji": "すみません",
                    "hiragana": "すみません",
                    "priority": 5
                }
            ],
            "あたらしい": [
                {
                    "kanji": "新しい",
                    "hiragana": "あたらしい",
                    "priority": 5
                }
            ],
            "たんご": [
                {
                    "kanji": "単語",
                    "hiragana": "たんご",
                    "priority": 3
                }
            ],
            "に": [
                {
                    "kanji": "に",
                    "hiragana": "に",
                    "priority": 3
                }
            ],
            "する": [
                {
                    "kanji": "する",
                    "hiragana": "する",
                    "priority": 3
                }
            ],
            "あした": [
                {
                    "kanji": "明日",
                    "hiragana": "あした",
                    "priority": 3
                }
            ],
            "きょう": [
                {
                    "kanji": "今日",
                    "hiragana": "きょう",
                    "priority": 3
                }
            ],
            "にほん": [
                {
                    "kanji": "日本",
                    "hiragana": "にほん",
                    "priority": 5
                }
            ],
            "にほんご": [
                {
                    "kanji": "日本語",
                    "hiragana": "にほんご",
                    "priority": 5
                }
            ],
            "にほんじん": [
                {
                    "kanji": "日本人",
                    "hiragana": "にほんじん",
                    "priority": 5
                }
            ],
            "いみふめい": [
                {
                    "kanji": "意味不明",
                    "hiragana": "いみふめい",
                    "priority": 5
                }
            ],
            "なんで": [
                {
                    "kanji": "何で",
                    "hiragana": "なんで",
                    "priority": 5
                }
            ],
            "いみわからん": [
                {
                    "kanji": "意味わからん",
                    "hiragana": "いみわからん",
                    "priority": 5
                }
            ],
            "にほんごとしておかしい": [
                {
                    "kanji": "日本語としておかしい",
                    "hiragana": "にほんごとしておかしい",
                    "priority": 5
                }
            ],
            "まじか": [
                {
                    "kanji": "マジか",
                    "hiragana": "まじか",
                    "priority": 5
                }
            ],
            "ひまだな": [
                {
                    "kanji": "暇だな",
                    "hiragana": "ひまだな",
                    "priority": 1
                }
            ],
            "なにするか": [
                {
                    "kanji": "何するか",
                    "hiragana": "なにするか",
                    "priority": 1
                }
            ],
            "いこう": [
                {
                    "kanji": "行こう",
                    "hiragana": "いこう",
                    "priority": 1
                }
            ],
            "あける": [
                {
                    "kanji": "開ける",
                    "hiragana": "あける",
                    "priority": 1
                }
            ],
            "ほうしゅう": [
                {
                    "kanji": "報酬",
                    "hiragana": "ほうしゅう",
                    "priority": 1
                }
            ],
            "かぎ": [
                {
                    "kanji": "鍵",
                    "hiragana": "かぎ",
                    "priority": 1
                }
            ],
            "もってる": [
                {
                    "kanji": "持ってる",
                    "hiragana": "もってる",
                    "priority": 1
                }
            ],
            "つよくなる": [
                {
                    "kanji": "強くなる",
                    "hiragana": "つよくなる",
                    "priority": 1
                }
            ],
            "なくこくようせき": [
                {
                    "kanji": "鳴く黒曜石",
                    "hiragana": "なくこくようせき",
                    "priority": 1
                }
            ],
            "ていあん": [
                {
                    "kanji": "提案",
                    "hiragana": "ていあん",
                    "priority": 1
                }
            ],
            "つくる": [
                {
                    "kanji": "作る",
                    "hiragana": "つくる",
                    "priority": 1
                }
            ],
            "すてる": [
                {
                    "kanji": "捨てる",
                    "hiragana": "すてる",
                    "priority": 1
                }
            ],
            "しょしん": [
                {
                    "kanji": "初心",
                    "hiragana": "しょしん",
                    "priority": 1
                }
            ],
            "しょしんしゃ": [
                {
                    "kanji": "初心者",
                    "hiragana": "しょしんしゃ",
                    "priority": 1
                }
            ],
            "はじめる": [
                {
                    "kanji": "始める",
                    "hiragana": "はじめる",
                    "priority": 1
                }
            ],
            "きちく": [
                {
                    "kanji": "鬼畜",
                    "hiragana": "きちく",
                    "priority": 1
                }
            ],
            "きめる": [
                {
                    "kanji": "決める",
                    "hiragana": "きめる",
                    "priority": 1
                }
            ],
            "いやだ": [
                {
                    "kanji": "嫌だ",
                    "hiragana": "いやだ",
                    "priority": 1
                }
            ],
            "すてない": [
                {
                    "kanji": "捨てない",
                    "hiragana": "すてない",
                    "priority": 1
                }
            ],
            "いかせて": [
                {
                    "kanji": "行かせて",
                    "hiragana": "いかせて",
                    "priority": 1
                }
            ],
            "きのう": [
                {
                    "kanji": "昨日",
                    "hiragana": "きのう",
                    "priority": 1
                },
                {
                    "kanji": "機能",
                    "hiragana": "きのう",
                    "priority": 1
                }
            ],
            "じつは": [
                {
                    "kanji": "実は",
                    "hiragana": "じつは",
                    "priority": 1
                }
            ],
            "ぼく": [
                {
                    "kanji": "僕",
                    "hiragana": "ぼく",
                    "priority": 1
                }
            ],
            "つくった": [
                {
                    "kanji": "作った",
                    "hiragana": "つくった",
                    "priority": 1
                }
            ],
            "たろう": [
                {
                    "kanji": "太郎",
                    "hiragana": "たろう",
                    "priority": 1
                }
            ],
            "のこしとこ": [
                {
                    "kanji": "残しとこ",
                    "hiragana": "のこしとこ",
                    "priority": 1
                }
            ],
            "あかし": [
                {
                    "kanji": "証",
                    "hiragana": "あかし",
                    "priority": 1
                }
            ],
            "あげる": [
                {
                    "kanji": "上げる",
                    "hiragana": "あげる",
                    "priority": 1
                }
            ],
            "そんざいない": [
                {
                    "kanji": "存在ない",
                    "hiragana": "そんざいない",
                    "priority": 1
                }
            ],
            "かんたん": [
                {
                    "kanji": "簡単",
                    "hiragana": "かんたん",
                    "priority": 1
                }
            ],
            "れべる": [
                {
                    "kanji": "レベル",
                    "hiragana": "れべる",
                    "priority": 1
                }
            ],
            "せいせい": [
                {
                    "kanji": "生成",
                    "hiragana": "せいせい",
                    "priority": 1
                }
            ],
            "レベル": [
                {
                    "kanji": "レベル",
                    "hiragana": "レベル",
                    "priority": 1
                }
            ],
            "あいてむ": [
                {
                    "kanji": "アイテム",
                    "hiragana": "あいてむ",
                    "priority": 1
                }
            ],
            "ぴーぶいぴーぜい": [
                {
                    "kanji": "PVP勢",
                    "hiragana": "ぴーぶいぴーぜい",
                    "priority": 1
                }
            ],
            "いきのこれる": [
                {
                    "kanji": "生き残れる",
                    "hiragana": "いきのこれる",
                    "priority": 1
                }
            ],
            "ぴんぐ": [
                {
                    "kanji": "ピング",
                    "hiragana": "ぴんぐ",
                    "priority": 1
                }
            ],
            "ラグさ": [
                {
                    "kanji": "ラグさ",
                    "hiragana": "ラグさ",
                    "priority": 1
                }
            ],
            "すいっち": [
                {
                    "kanji": "スイッチ",
                    "hiragana": "すいっち",
                    "priority": 1
                }
            ],
            "こうくん": [
                {
                    "kanji": "こう君",
                    "hiragana": "こうくん",
                    "priority": 1
                }
            ],
            "さばぬし": [
                {
                    "kanji": "鯖主",
                    "hiragana": "さばぬし",
                    "priority": 1
                }
            ],
            "でざいん": [
                {
                    "kanji": "デザイン",
                    "hiragana": "でざいん",
                    "priority": 1
                }
            ],
            "すきすぎる": [
                {
                    "kanji": "好きすぎる",
                    "hiragana": "すきすぎる",
                    "priority": 1
                }
            ],
            "きす": [
                {
                    "kanji": "キス",
                    "hiragana": "きす",
                    "priority": 1
                }
            ],
            "だきまくら": [
                {
                    "kanji": "抱き枕",
                    "hiragana": "だきまくら",
                    "priority": 1
                }
            ],
            "はんばい": [
                {
                    "kanji": "販売",
                    "hiragana": "はんばい",
                    "priority": 1
                }
            ],
            "あどおん": [
                {
                    "kanji": "アドオン",
                    "hiragana": "あどおん",
                    "priority": 1
                }
            ],
            "かくせい": [
                {
                    "kanji": "覚醒",
                    "hiragana": "かくせい",
                    "priority": 1
                }
            ],
            "ころす": [
                {
                    "kanji": "殺す",
                    "hiragana": "ころす",
                    "priority": 1
                }
            ],
            "ごーれむ": [
                {
                    "kanji": "ゴーレム",
                    "hiragana": "ごーれむ",
                    "priority": 1
                }
            ],
            "くそたのしい": [
                {
                    "kanji": "くそ楽しい",
                    "hiragana": "くそたのしい",
                    "priority": 1
                }
            ],
            "そうび": [
                {
                    "kanji": "装備",
                    "hiragana": "そうび",
                    "priority": 1
                }
            ],
            "ととのえる": [
                {
                    "kanji": "整える",
                    "hiragana": "ととのえる",
                    "priority": 1
                }
            ],
            "てきとう": [
                {
                    "kanji": "適当",
                    "hiragana": "てきとう",
                    "priority": 1
                }
            ],
            "だす": [
                {
                    "kanji": "出す",
                    "hiragana": "だす",
                    "priority": 1
                }
            ],
            "わたす": [
                {
                    "kanji": "渡す",
                    "hiragana": "わたす",
                    "priority": 1
                }
            ],
            "ぶき": [
                {
                    "kanji": "武器",
                    "hiragana": "ぶき",
                    "priority": 1
                }
            ],
            "どこらへん": [
                {
                    "kanji": "ざひょう",
                    "hiragana": "どこらへん",
                    "priority": 1
                }
            ],
            "座標": [
                {
                    "kanji": "もうみんなのとこいますで",
                    "hiragana": "座標",
                    "priority": 1
                }
            ],
            "たつじん": [
                {
                    "kanji": "達人",
                    "hiragana": "たつじん",
                    "priority": 1
                }
            ],
            "べんとう": [
                {
                    "kanji": "弁当",
                    "hiragana": "べんとう",
                    "priority": 1
                }
            ],
            "はらへり": [
                {
                    "kanji": "腹減り",
                    "hiragana": "はらへり",
                    "priority": 1
                }
            ],
            "たろうさんいまどんなかんじ": [
                {
                    "kanji": "太郎さんいまどんな感じ",
                    "hiragana": "たろうさんいまどんなかんじ",
                    "priority": 1
                }
            ],
            "こいんとす": [
                {
                    "kanji": "コイントス",
                    "hiragana": "こいんとす",
                    "priority": 1
                }
            ],
            "おもて": [
                {
                    "kanji": "表",
                    "hiragana": "おもて",
                    "priority": 1
                }
            ],
            "でる": [
                {
                    "kanji": "出る",
                    "hiragana": "でる",
                    "priority": 1
                }
            ],
            "かず": [
                {
                    "kanji": "数",
                    "hiragana": "かず",
                    "priority": 1
                }
            ],
            "ふぃーるど": [
                {
                    "kanji": "フィールド",
                    "hiragana": "ふぃーるど",
                    "priority": 1
                }
            ],
            "もんすたー": [
                {
                    "kanji": "モンスター",
                    "hiragana": "もんすたー",
                    "priority": 1
                }
            ],
            "はかい": [
                {
                    "kanji": "破壊",
                    "hiragana": "はかい",
                    "priority": 1
                }
            ],
            "こうか": [
                {
                    "kanji": "効果",
                    "hiragana": "こうか",
                    "priority": 1
                }
            ],
            "たーん": [
                {
                    "kanji": "ターン",
                    "hiragana": "たーん",
                    "priority": 1
                }
            ],
            "じぶん": [
                {
                    "kanji": "自分",
                    "hiragana": "じぶん",
                    "priority": 1
                }
            ],
            "めいんふぇいず": [
                {
                    "kanji": "メインフェイズ",
                    "hiragana": "めいんふぇいず",
                    "priority": 1
                }
            ],
            "しよう": [
                {
                    "kanji": "使用",
                    "hiragana": "しよう",
                    "priority": 1
                }
            ],
            "えんどゆーざー": [
                {
                    "kanji": "エンドユーザー",
                    "hiragana": "えんどゆーざー",
                    "priority": 1
                }
            ],
            "かんしん": [
                {
                    "kanji": "関心",
                    "hiragana": "かんしん",
                    "priority": 1
                }
            ],
            "ある": [
                {
                    "kanji": "有る",
                    "hiragana": "ある",
                    "priority": 1
                }
            ],
            "びょうき": [
                {
                    "kanji": "病気",
                    "hiragana": "びょうき",
                    "priority": 1
                }
            ],
            "たいして": [
                {
                    "kanji": "対して",
                    "hiragana": "たいして",
                    "priority": 1
                }
            ],
            "とくい": [
                {
                    "kanji": "得意",
                    "hiragana": "とくい",
                    "priority": 1
                }
            ],
            "どくたー": [
                {
                    "kanji": "ドクター",
                    "hiragana": "どくたー",
                    "priority": 1
                }
            ],
            "さがす": [
                {
                    "kanji": "探す",
                    "hiragana": "さがす",
                    "priority": 1
                }
            ],
            "そこで": [
                {
                    "kanji": "全国",
                    "hiragana": "そこで",
                    "priority": 1
                }
            ],
            "しょうかい": [
                {
                    "kanji": "紹介",
                    "hiragana": "しょうかい",
                    "priority": 1
                }
            ],
            "こーなー": [
                {
                    "kanji": "コーナー",
                    "hiragana": "こーなー",
                    "priority": 1
                }
            ],
            "もうける": [
                {
                    "kanji": "設ける",
                    "hiragana": "もうける",
                    "priority": 1
                }
            ],
            "みなさま": [
                {
                    "kanji": "皆様",
                    "hiragana": "みなさま",
                    "priority": 1
                }
            ],
            "きょうりょく": [
                {
                    "kanji": "協力",
                    "hiragana": "きょうりょく",
                    "priority": 1
                }
            ],
            "ほど": [
                {
                    "kanji": "程",
                    "hiragana": "ほど",
                    "priority": 1
                }
            ],
            "ねがう": [
                {
                    "kanji": "願う",
                    "hiragana": "ねがう",
                    "priority": 1
                }
            ],
            "ちいき": [
                {
                    "kanji": "地域",
                    "hiragana": "ちいき",
                    "priority": 1
                }
            ],
            "かつどう": [
                {
                    "kanji": "活動",
                    "hiragana": "かつどう",
                    "priority": 1
                }
            ],
            "しえん": [
                {
                    "kanji": "支援",
                    "hiragana": "しえん",
                    "priority": 1
                }
            ],
            "せんたー": [
                {
                    "kanji": "センター",
                    "hiragana": "せんたー",
                    "priority": 1
                }
            ],
            "かしわし": [
                {
                    "kanji": "柏市",
                    "hiragana": "かしわし",
                    "priority": 1
                }
            ],
            "ひまわり": [
                {
                    "kanji": "ひまわり",
                    "hiragana": "ひまわり",
                    "priority": 1
                }
            
            ],
            "へいせい": [
                {
                    "kanji": "平成",
                    "hiragana": "へいせい",
                    "priority": 1
                }
            ],
            "ねんど": [
                {
                    "kanji": "年度",
                    "hiragana": "ねんど",
                    "priority": 1
                }
            ],
            "みんえいか": [
                {
                    "kanji": "民営化",
                    "hiragana": "みんえいか",
                    "priority": 1
                }
            ],
            "ながきてき": [
                {
                    "kanji": "長期的",
                    "hiragana": "ながきてき",
                    "priority": 1
                }
            ],
            "うんえい": [
                {
                    "kanji": "運営",
                    "hiragana": "うんえい",
                    "priority": 1
                }
            ],
            "しゃかい": [
                {
                    "kanji": "社会",
                    "hiragana": "しゃかい",
                    "priority": 1
                }
            ],
            "ふくし": [
                {
                    "kanji": "福祉",
                    "hiragana": "ふくし",
                    "priority": 1
                }
            ],
            "ほうじん": [
                {
                    "kanji": "法人",
                    "hiragana": "ほうじん",
                    "priority": 1
                }
            ],
            "とう": [
                {
                    "kanji": "等",
                    "hiragana": "とう",
                    "priority": 1
                }
            ],
            "じぎょうしょ": [
                {
                    "kanji": "事業所",
                    "hiragana": "じぎょうしょ",
                    "priority": 1
                }
            ],
            "ぼしゅう": [
                {
                    "kanji": "募集",
                    "hiragana": "ぼしゅう",
                    "priority": 1
                }
            ],
            "みんえい": [
                {
                    "kanji": "民営",
                    "hiragana": "みんえい",
                    "priority": 1
                }
            ],
            "せんたく": [
                {
                    "kanji": "選択",
                    "hiragana": "せんたく",
                    "priority": 1
                }
            ],
            "しょうがい": [
                {
                    "kanji": "障害",
                    "hiragana": "しょうがい",
                    "priority": 1
                },
                {
                    "kanji": "状態",
                    "hiragana": "しょうがい",
                    "priority": 1
                }
            ],
            "じぎょう": [
                {
                    "kanji": "事業",
                    "hiragana": "じぎょう",
                    "priority": 1
                }
            ],
            "しょうがいしゃ": [
                {
                    "kanji": "障害者",
                    "hiragana": "しょうがいしゃ",
                    "priority": 1
                }
            ],
            "じりつ": [
                {
                    "kanji": "自立",
                    "hiragana": "じりつ",
                    "priority": 1
                }
            ],
            "さんか": [
                {
                    "kanji": "参加",
                    "hiragana": "さんか",
                    "priority": 1
                }
            ],
            "いよく": [
                {
                    "kanji": "意欲",
                    "hiragana": "いよく",
                    "priority": 1
                }
            ],
            "おうぼ": [
                {
                    "kanji": "応募",
                    "hiragana": "おうぼ",
                    "priority": 1
                }
            ],
            "まつ": [
                {
                    "kanji": "待つ",
                    "hiragana": "まつ",
                    "priority": 1
                }
            ],
            "えひめけん": [
                {
                    "kanji": "愛媛県",
                    "hiragana": "えひめけん",
                    "priority": 1
                }
            ],
            "いまばりし": [
                {
                    "kanji": "今治市",
                    "hiragana": "いまばりし",
                    "priority": 1
                }
            ],
            "しゅっしん": [
                {
                    "kanji": "出身",
                    "hiragana": "しゅっしん",
                    "priority": 1
                }
            ],
            "こうこう": [
                {
                    "kanji": "高校",
                    "hiragana": "こうこう",
                    "priority": 1
                }
            ],
            "じもと": [
                {
                    "kanji": "地元",
                    "hiragana": "じもと",
                    "priority": 1
                }
            ],
            "そだつ": [
                {
                    "kanji": "育つ",
                    "hiragana": "そだつ",
                    "priority": 1
                }
            ],
            "だいがく": [
                {
                    "kanji": "大学",
                    "hiragana": "だいがく",
                    "priority": 1
                }
            ],
            "じだい": [
                {
                    "kanji": "時代",
                    "hiragana": "じだい",
                    "priority": 1
                }
            ],
            "とうきょう": [
                {
                    "kanji": "東京",
                    "hiragana": "とうきょう",
                    "priority": 1
                }
            ],
            "かぐらざか": [
                {
                    "kanji": "神楽坂",
                    "hiragana": "かぐらざか",
                    "priority": 1
                }
            ],
            "くらす": [
                {
                    "kanji": "暮らす",
                    "hiragana": "くらす",
                    "priority": 1
                },
                {
                    "kanji": "クラス",
                    "hiragana": "くらす",
                    "priority": 1
                }
            ],
            "まつやま": [
                {
                    "kanji": "松山",
                    "hiragana": "まつやま",
                    "priority": 1
                }
            ],
            "れきし": [
                {
                    "kanji": "歴史",
                    "hiragana": "れきし",
                    "priority": 1
                }
            ],
            "かんじる": [
                {
                    "kanji": "感じる",
                    "hiragana": "かんじる",
                    "priority": 1
                }
            ],
            "ふぜい": [
                {
                    "kanji": "風情",
                    "hiragana": "ふぜい",
                    "priority": 1
                }
            ],
            "ところ": [
                {
                    "kanji": "所",
                    "hiragana": "ところ",
                    "priority": 1
                }
            ],
            "どうが": [
                {
                    "kanji": "動画",
                    "hiragana": "どうが",
                    "priority": 1
                }
            ],
            "なか": [
                {
                    "kanji": "中",
                    "hiragana": "なか",
                    "priority": 1
                }
            ],
            "すくうぇあ": [
                {
                    "kanji": "スクウェア",
                    "hiragana": "すくうぇあ",
                    "priority": 1
                }
            ],
            "えにっくす": [
                {
                    "kanji": "エニックス",
                    "hiragana": "えにっくす",
                    "priority": 1
                }
            ],
            "わだ": [
                {
                    "kanji": "和田",
                    "hiragana": "わだ",
                    "priority": 1
                }
            ],
            "しゃちょう": [
                {
                    "kanji": "社長",
                    "hiragana": "しゃちょう",
                    "priority": 1
                }
            ],
            "まじこん": [
                {
                    "kanji": "マジコン",
                    "hiragana": "まじこん",
                    "priority": 1
                }
            ],
            "こめんと": [
                {
                    "kanji": "コメント",
                    "hiragana": "こめんと",
                    "priority": 1
                }
            ],
            "おおきな": [
                {
                    "kanji": "大きな",
                    "hiragana": "おおきな",
                    "priority": 1
                }
            ],
            "きょうい": [
                {
                    "kanji": "脅威",
                    "hiragana": "きょうい",
                    "priority": 1
                }
            ],
            "だだげき": [
                {
                    "kanji": "大打撃",
                    "hiragana": "だだげき",
                    "priority": 1
                }
            ],
            "おおげさ": [
                {
                    "kanji": "事",
                    "hiragana": "おおげさ",
                    "priority": 1
                }
            ],
            "ほんとう": [
                {
                    "kanji": "本当",
                    "hiragana": "ほんとう",
                    "priority": 1
                }
            ],
            "ほうどう": [
                {
                    "kanji": "報道",
                    "hiragana": "ほうどう",
                    "priority": 1
                }
            ],
            "ばんぐみ": [
                {
                    "kanji": "番組",
                    "hiragana": "ばんぐみ",
                    "priority": 1
                }
            ],
            "とりあげる": [
                {
                    "kanji": "取り上げる",
                    "hiragana": "とりあげる",
                    "priority": 1
                }
            ],
            "おどろき": [
                {
                    "kanji": "驚き",
                    "hiragana": "おどろき",
                    "priority": 1
                }
            ],
            "りょこうしゃ": [
                {
                    "kanji": "旅行社",
                    "hiragana": "りょこうしゃ",
                    "priority": 1
                }
            ],
            "しょはん": [
                {
                    "kanji": "諸般",
                    "hiragana": "しょはん",
                    "priority": 1
                }
            ],
            "じじょう": [
                {
                    "kanji": "事情",
                    "hiragana": "じじょう",
                    "priority": 1
                }
            ],
            "しょうさい": [
                {
                    "kanji": "詳細",
                    "hiragana": "しょうさい",
                    "priority": 1
                }
            ],
            "しるす": [
                {
                    "kanji": "記す",
                    "hiragana": "しるす",
                    "priority": 1
                }
            ],
            "やめる": [
                {
                    "kanji": "ツアー",
                    "hiragana": "やめる",
                    "priority": 1
                }
            ],
            "たんなる": [
                {
                    "kanji": "単なる",
                    "hiragana": "たんなる",
                    "priority": 1
                }
            ],
            "じしん": [
                {
                    "kanji": "自身",
                    "hiragana": "じしん",
                    "priority": 1
                },
                {
                    "kanji": "自信",
                    "hiragana": "じしん",
                    "priority": 1
                }
            ],
            "はんだん": [
                {
                    "kanji": "判断",
                    "hiragana": "はんだん",
                    "priority": 1
                }
            ],
            "もうしこみ": [
                {
                    "kanji": "申し込み",
                    "hiragana": "もうしこみ",
                    "priority": 1
                }
            ],
            "ささもと": [
                {
                    "kanji": "笹本",
                    "hiragana": "ささもと",
                    "priority": 1
                }
            ],
            "ゆういち": [
                {
                    "kanji": "祐一",
                    "hiragana": "ゆういち",
                    "priority": 1
                }
            ],
            "みにすか": [
                {
                    "kanji": "ミニスカ",
                    "hiragana": "みにすか",
                    "priority": 1
                }
            ],
            "うちゅう": [
                {
                    "kanji": "宇宙",
                    "hiragana": "うちゅう",
                    "priority": 1
                }
            ],
            "かいぞく": [
                {
                    "kanji": "海賊",
                    "hiragana": "かいぞく",
                    "priority": 1
                }
            ],
            "あにめか": [
                {
                    "kanji": "アニメ化",
                    "hiragana": "あにめか",
                    "priority": 1
                }
            ],
            "けってい": [
                {
                    "kanji": "決定",
                    "hiragana": "けってい",
                    "priority": 1
                }
            ],
            "かんとく": [
                {
                    "kanji": "監督",
                    "hiragana": "かんとく",
                    "priority": 1
                }
            ],
            "しりーず": [
                {
                    "kanji": "シリーズ",
                    "hiragana": "しりーず",
                    "priority": 1
                }
            ],
            "こうせい": [
                {
                    "kanji": "構成",
                    "hiragana": "こうせい",
                    "priority": 1
                }
            ],
            "さとう": [
                {
                    "kanji": "佐藤",
                    "hiragana": "さとう",
                    "priority": 1
                }
            ],
            "たつお": [
                {
                    "kanji": "竜雄",
                    "hiragana": "たつお",
                    "priority": 1
                }
            ],
            "あにめーしょん": [
                {
                    "kanji": "アニメーション",
                    "hiragana": "あにめーしょん",
                    "priority": 1
                }
            ],
            "せいさく": [
                {
                    "kanji": "制作",
                    "hiragana": "せいさく",
                    "priority": 1
                }
            ],
            "さてらいと": [
                {
                    "kanji": "サテライト",
                    "hiragana": "さてらいと",
                    "priority": 1
                }
            ],
            "ほうえい": [
                {
                    "kanji": "放映",
                    "hiragana": "ほうえい",
                    "priority": 1
                }
            ],
            "よてい": [
                {
                    "kanji": "予定",
                    "hiragana": "よてい",
                    "priority": 1
                }
            ],
            "かわごえ": [
                {
                    "kanji": "川越",
                    "hiragana": "かわごえ",
                    "priority": 1
                }
            ],
            "しない": [
                {
                    "kanji": "市内",
                    "hiragana": "しない",
                    "priority": 1
                }
            ],
            "さいしん": [
                {
                    "kanji": "最新",
                    "hiragana": "さいしん",
                    "priority": 1
                }
            ],
            "そうごう": [
                {
                    "kanji": "総合",
                    "hiragana": "そうごう",
                    "priority": 1
                }
            ],
            "じゅうたく": [
                {
                    "kanji": "住宅",
                    "hiragana": "じゅうたく",
                    "priority": 1
                }
            ],
            "てんじじょう": [
                {
                    "kanji": "展示場",
                    "hiragana": "てんじじょう",
                    "priority": 1
                }
            ],
            "はうじんぐ": [
                {
                    "kanji": "ハウジング",
                    "hiragana": "はうじんぐ",
                    "priority": 1
                }
            ],
            "ぎゃらりー": [
                {
                    "kanji": "ギャラリー",
                    "hiragana": "ぎゃらりー",
                    "priority": 1
                }
            ],
            "せんしん": [
                {
                    "kanji": "先進",
                    "hiragana": "せんしん",
                    "priority": 1
                }
            ],
            "もでるはうす": [
                {
                    "kanji": "モデルハウス",
                    "hiragana": "もでるはうす",
                    "priority": 1
                }
            ],
            "たいかん": [
                {
                    "kanji": "体感",
                    "hiragana": "たいかん",
                    "priority": 1
                }
            ],
            "すまい": [
                {
                    "kanji": "住まい",
                    "hiragana": "すまい",
                    "priority": 1
                }
            ],
            "つくり": [
                {
                    "kanji": "作り",
                    "hiragana": "つくり",
                    "priority": 1
                }
            ],
            "てつだい": [
                {
                    "kanji": "手伝い",
                    "hiragana": "てつだい",
                    "priority": 1
                }
            ],
            "まいつき": [
                {
                    "kanji": "毎月",
                    "hiragana": "まいつき",
                    "priority": 1
                }
            ],
            "いべんと": [
                {
                    "kanji": "イベント",
                    "hiragana": "いべんと",
                    "priority": 1
                }
            ],
            "ようい": [
                {
                    "kanji": "用意",
                    "hiragana": "ようい",
                    "priority": 1
                }
            ],
            "らいじょう": [
                {
                    "kanji": "来場",
                    "hiragana": "らいじょう",
                    "priority": 1
                }
            ],
            "きがつけば": [
                {
                    "kanji": "気がつけば",
                    "hiragana": "きがつけば",
                    "priority": 1
                }
            ],
            "つゆ": [
                {
                    "kanji": "梅雨",
                    "hiragana": "つゆ",
                    "priority": 1
                }
            ],
            "まいにち": [
                {
                    "kanji": "毎日",
                    "hiragana": "まいにち",
                    "priority": 1
                }
            ],
            "あつい": [
                {
                    "kanji": "暑い",
                    "hiragana": "あつい",
                    "priority": 1
                }
            ],
            "ひ": [
                {
                    "kanji": "日",
                    "hiragana": "ひ",
                    "priority": 1
                }
            ],
            "つづく": [
                {
                    "kanji": "続く",
                    "hiragana": "つづく",
                    "priority": 1
                }
            ],
            "ちち": [
                {
                    "kanji": "父",
                    "hiragana": "ちち",
                    "priority": 1
                }
            ],
            "しゅじゅつ": [
                {
                    "kanji": "手術",
                    "hiragana": "しゅじゅつ",
                    "priority": 1
                }
            ],
            "ぶじ": [
                {
                    "kanji": "無事",
                    "hiragana": "ぶじ",
                    "priority": 1
                }
            ],
            "おわる": [
                {
                    "kanji": "終わる",
                    "hiragana": "おわる",
                    "priority": 1
                }
            ],
            "ほっと": [
                {
                    "kanji": "ネット",
                    "hiragana": "ほっと",
                    "priority": 1
                }
            ],
            "みて": [
                {
                    "kanji": "見て",
                    "hiragana": "みて",
                    "priority": 1
                }
            ],
            "きになる": [
                {
                    "kanji": "気になる",
                    "hiragana": "きになる",
                    "priority": 1
                }
            ],
            "ふなやど": [
                {
                    "kanji": "船宿",
                    "hiragana": "ふなやど",
                    "priority": 1
                }
            ],
            "さいきん": [
                {
                    "kanji": "最近",
                    "hiragana": "さいきん",
                    "priority": 1
                }
            ],
            "なんぼうそう": [
                {
                    "kanji": "南房総",
                    "hiragana": "なんぼうそう",
                    "priority": 1
                }
            ],
            "あいはまこう": [
                {
                    "kanji": "相浜港",
                    "hiragana": "あいはまこう",
                    "priority": 1
                }
            ],
            "やすだまる": [
                {
                    "kanji": "安田丸",
                    "hiragana": "やすだまる",
                    "priority": 1
                }
            ],
            "なに": [
                {
                    "kanji": "何",
                    "hiragana": "なに",
                    "priority": 1
                }
            ],
            "おにかさご": [
                {
                    "kanji": "オニカサゴ",
                    "hiragana": "おにかさご",
                    "priority": 1
                }
            ],
            "ちょうか": [
                {
                    "kanji": "釣果",
                    "hiragana": "ちょうか",
                    "priority": 1
                }
            ],
            "あんてい": [
                {
                    "kanji": "安定",
                    "hiragana": "あんてい",
                    "priority": 1
                }
            ],
            "いわて": [
                {
                    "kanji": "岩手",
                    "hiragana": "いわて",
                    "priority": 1
                }
            ],
            "みやぎ": [
                {
                    "kanji": "宮城",
                    "hiragana": "みやぎ",
                    "priority": 1
                }
            ],
            "ないりく": [
                {
                    "kanji": "内陸",
                    "hiragana": "ないりく",
                    "priority": 1
                }
            ],
            "ひがいがく": [
                {
                    "kanji": "被害額",
                    "hiragana": "ひがいがく",
                    "priority": 1
                }
            ],
            "げんざい": [
                {
                    "kanji": "現在",
                    "hiragana": "げんざい",
                    "priority": 1
                }
            ],
            "けん": [
                {
                    "kanji": "県",
                    "hiragana": "けん",
                    "priority": 1
                },
                {
                    "kanji": "件",
                    "hiragana": "けん",
                    "priority": 1
                }
            ],
            "さいがい": [
                {
                    "kanji": "災害",
                    "hiragana": "さいがい",
                    "priority": 1
                }
            ],
            "たいさく": [
                {
                    "kanji": "対策",
                    "hiragana": "たいさく",
                    "priority": 1
                }
            ],
            "ほんぶ": [
                {
                    "kanji": "本部",
                    "hiragana": "ほんぶ",
                    "priority": 1
                }
            ],
            "ふくらむ": [
                {
                    "kanji": "膨らむ",
                    "hiragana": "ふくらむ",
                    "priority": 1
                }
            ],
            "いぜん": [
                {
                    "kanji": "依然",
                    "hiragana": "いぜん",
                    "priority": 1
                }
            ],
            "のうりん": [
                {
                    "kanji": "農林",
                    "hiragana": "のうりん",
                    "priority": 1
                }
            ],
            "どぼく": [
                {
                    "kanji": "土木",
                    "hiragana": "どぼく",
                    "priority": 1
                }
            ],
            "かんけい": [
                {
                    "kanji": "関係",
                    "hiragana": "かんけい",
                    "priority": 1
                }
            ],
            "かくだい": [
                {
                    "kanji": "拡大",
                    "hiragana": "かくだい",
                    "priority": 1
                }
            ],
            "ひなん": [
                {
                    "kanji": "避難",
                    "hiragana": "ひなん",
                    "priority": 1
                }
            ],
            "せいかつしゃ": [
                {
                    "kanji": "生活者",
                    "hiragana": "せいかつしゃ",
                    "priority": 1
                }
            ],
            "おうしゅうし": [
                {
                    "kanji": "奥州市",
                    "hiragana": "おうしゅうし",
                    "priority": 1
                }
            ],
            "せたい": [
                {
                    "kanji": "世帯",
                    "hiragana": "せたい",
                    "priority": 1
                }
            ],
            "へる": [
                {
                    "kanji": "減る",
                    "hiragana": "へる",
                    "priority": 1
                }
            ],
            "かぞえる": [
                {
                    "kanji": "数える",
                    "hiragana": "かぞえる",
                    "priority": 1
                }
            ],
            "しんてんぽ": [
                {
                    "kanji": "新店舗",
                    "hiragana": "しんてんぽ",
                    "priority": 1
                }
            ],
            "りにゅーある": [
                {
                    "kanji": "リニューアル",
                    "hiragana": "りにゅーある",
                    "priority": 1
                }
            ],
            "どすぱら": [
                {
                    "kanji": "ドスパラ",
                    "hiragana": "どすぱら",
                    "priority": 1
                }
            ],
            "よこはま": [
                {
                    "kanji": "横浜",
                    "hiragana": "よこはま",
                    "priority": 1
                }
            ],
            "べっかん": [
                {
                    "kanji": "別館",
                    "hiragana": "べっかん",
                    "priority": 1
                }
            ],
            "ちゅうこひん": [
                {
                    "kanji": "中古品",
                    "hiragana": "ちゅうこひん",
                    "priority": 1
                }
            ],
            "かいとり": [
                {
                    "kanji": "買取り",
                    "hiragana": "かいとり",
                    "priority": 1
                }
            ],
            "さぽーと": [
                {
                    "kanji": "サポート",
                    "hiragana": "さぽーと",
                    "priority": 1
                }
            ],
            "せんもんてん": [
                {
                    "kanji": "専門店",
                    "hiragana": "せんもんてん",
                    "priority": 1
                }
            ],
            "うまれかわる": [
                {
                    "kanji": "生まれ変わる",
                    "hiragana": "うまれかわる",
                    "priority": 1
                }
            ],
            "すたっふ": [
                {
                    "kanji": "スタッフ",
                    "hiragana": "すたっふ",
                    "priority": 1
                }
            ],
            "いちどう": [
                {
                    "kanji": "一同",
                    "hiragana": "いちどう",
                    "priority": 1
                }
            ],
            "こころ": [
                {
                    "kanji": "心",
                    "hiragana": "こころ",
                    "priority": 1
                }
            ],
            "てんき": [
                {
                    "kanji": "天気",
                    "hiragana": "てんき",
                    "priority": 1
                }
            ],
            "やじゅう": [
                {
                    "kanji": "野獣",
                    "hiragana": "やじゅう",
                    "priority": 1
                }
            ],
            "やじゅうせんぱい": [
                {
                    "kanji": "野獣先輩",
                    "hiragana": "やじゅうせんぱい",
                    "priority": 1
                }
            ],
            "ぜんこく": [
                {
                    "kanji": "全国",
                    "hiragana": "ぜんこく",
                    "priority": 1
                }
            ],
            "みにすとっぷ": [
                {
                    "kanji": "ミニストップ",
                    "hiragana": "みにすとっぷ",
                    "priority": 1
                }
            ],
            "てんぽ": [
                {
                    "kanji": "店舗",
                    "hiragana": "てんぽ",
                    "priority": 1
                }
            ],
            "ぼきん": [
                {
                    "kanji": "募金",
                    "hiragana": "ぼきん",
                    "priority": 1
                }
            ],
            "じっし": [
                {
                    "kanji": "実施",
                    "hiragana": "じっし",
                    "priority": 1
                }
            ],
            "おきゃくさま": [
                {
                    "kanji": "お客様",
                    "hiragana": "おきゃくさま",
                    "priority": 1
                }
            ],
            "あずかる": [
                {
                    "kanji": "預かる",
                    "hiragana": "あずかる",
                    "priority": 1
                }
            ],
            "つうじる": [
                {
                    "kanji": "通じる",
                    "hiragana": "つうじる",
                    "priority": 1
                }
            ],
            "かんきょう": [
                {
                    "kanji": "環境",
                    "hiragana": "かんきょう",
                    "priority": 1
                }
            ],
            "ほぜん": [
                {
                    "kanji": "保全",
                    "hiragana": "ほぜん",
                    "priority": 1
                }
            ],
            "こうけん": [
                {
                    "kanji": "貢献",
                    "hiragana": "こうけん",
                    "priority": 1
                }
            ],
            "いおん": [
                {
                    "kanji": "イオン",
                    "hiragana": "いおん",
                    "priority": 1
                }
            ],
            "ぐるーぷ": [
                {
                    "kanji": "グループ",
                    "hiragana": "ぐるーぷ",
                    "priority": 1
                }
            ],
            "そうりょく": [
                {
                    "kanji": "総力",
                    "hiragana": "そうりょく",
                    "priority": 1
                }
            ],
            "うんどう": [
                {
                    "kanji": "運動",
                    "hiragana": "うんどう",
                    "priority": 1
                }
            ],
            "てんとう": [
                {
                    "kanji": "店頭",
                    "hiragana": "てんとう",
                    "priority": 1
                }
            ],
            "つうねん": [
                {
                    "kanji": "通年",
                    "hiragana": "つうねん",
                    "priority": 1
                }
            ],
            "めがみ": [
                {
                    "kanji": "女神",
                    "hiragana": "めがみ",
                    "priority": 1
                }
            ],
            "てんし": [
                {
                    "kanji": "天使",
                    "hiragana": "てんし",
                    "priority": 1
                }
            ],
            "はこぶね": [
                {
                    "kanji": "方舟",
                    "hiragana": "はこぶね",
                    "priority": 1
                }
            ],
            "せんしつ": [
                {
                    "kanji": "泉質",
                    "hiragana": "せんしつ",
                    "priority": 1
                }
            ],
            "いちょう": [
                {
                    "kanji": "胃腸",
                    "hiragana": "いちょう",
                    "priority": 1
                }
            ],
            "しんけいつう": [
                {
                    "kanji": "神経痛",
                    "hiragana": "しんけいつう",
                    "priority": 1
                }
            ],
            "ふじん": [
                {
                    "kanji": "婦人",
                    "hiragana": "ふじん",
                    "priority": 1
                }
            ],
            "ろてんぶろ": [
                {
                    "kanji": "露天風呂",
                    "hiragana": "ろてんぶろ",
                    "priority": 1
                }
            ],
            "だいよくじょう": [
                {
                    "kanji": "大浴場",
                    "hiragana": "だいよくじょう",
                    "priority": 1
                }
            ],
            "きぶん": [
                {
                    "kanji": "気分",
                    "hiragana": "きぶん",
                    "priority": 1
                }
            ],
            "すご": [
                {
                    "kanji": "過ご",
                    "hiragana": "すご",
                    "priority": 1
                }
            ],
            "ふくげん": [
                {
                    "kanji": "復元",
                    "hiragana": "ふくげん",
                    "priority": 1
                }
            ],
            "せんごく": [
                {
                    "kanji": "戦国",
                    "hiragana": "せんごく",
                    "priority": 1
                }
            ],
            "ぶしょう": [
                {
                    "kanji": "武将",
                    "hiragana": "ぶしょう",
                    "priority": 1
                }
            ],
            "じんばおり": [
                {
                    "kanji": "陣羽織",
                    "hiragana": "じんばおり",
                    "priority": 1
                }
            ],
            "しちゃく": [
                {
                    "kanji": "試着",
                    "hiragana": "しちゃく",
                    "priority": 1
                }
            ],
            "さつえい": [
                {
                    "kanji": "撮影",
                    "hiragana": "さつえい",
                    "priority": 1
                }
            ],
            "ともだち": [
                {
                    "kanji": "友達",
                    "hiragana": "ともだち",
                    "priority": 1
                }
            ],
            "どうし": [
                {
                    "kanji": "同士",
                    "hiragana": "どうし",
                    "priority": 1
                }
            ],
            "ひとり": [
                {
                    "kanji": "一人",
                    "hiragana": "ひとり",
                    "priority": 1
                }
            ],
            "きら": [
                {
                    "kanji": "気楽",
                    "hiragana": "きら",
                    "priority": 1
                }
            ],
            "こそで": [
                {
                    "kanji": "小袖",
                    "hiragana": "こそで",
                    "priority": 1
                }
            ],
            "とうひょう": [
                {
                    "kanji": "投票",
                    "hiragana": "とうひょう",
                    "priority": 1
                }
            ],
            "すいしょう": [
                {
                    "kanji": "推奨",
                    "hiragana": "すいしょう",
                    "priority": 1
                }
            ],
            "せんでん": [
                {
                    "kanji": "宣伝",
                    "hiragana": "せんでん",
                    "priority": 1
                }
            ],
            "かつよう": [
                {
                    "kanji": "活用",
                    "hiragana": "かつよう",
                    "priority": 1
                }
            ],
            "かいいん": [
                {
                    "kanji": "開院",
                    "hiragana": "かいいん",
                    "priority": 1
                }
            ],
            "ほうもん": [
                {
                    "kanji": "訪問",
                    "hiragana": "ほうもん",
                    "priority": 1
                }
            ],
            "しんりょう": [
                {
                    "kanji": "診療",
                    "hiragana": "しんりょう",
                    "priority": 1
                }
            ],
            "じんりょく": [
                {
                    "kanji": "尽力",
                    "hiragana": "じんりょく",
                    "priority": 1
                }
            ],
            "かんじゃ": [
                {
                    "kanji": "患者",
                    "hiragana": "かんじゃ",
                    "priority": 1
                }
            ],
            "かいてき": [
                {
                    "kanji": "快適",
                    "hiragana": "かいてき",
                    "priority": 1
                }
            ],
            "ざいたく": [
                {
                    "kanji": "在宅",
                    "hiragana": "ざいたく",
                    "priority": 1
                }
            ],
            "りゃく": [
                {
                    "kanji": "略",
                    "hiragana": "りゃく",
                    "priority": 1
                }
            ],
            "わだい": [
                {
                    "kanji": "話題",
                    "hiragana": "わだい",
                    "priority": 1
                }
            ],
            "とっこう": [
                {
                    "kanji": "特定口座",
                    "hiragana": "とっこう",
                    "priority": 1
                }
            ],
            "とうしか": [
                {
                    "kanji": "投資家",
                    "hiragana": "とうしか",
                    "priority": 1
                }
            ],
            "のうぜい": [
                {
                    "kanji": "納税",
                    "hiragana": "のうぜい",
                    "priority": 1
                }
            ],
            "しんこく": [
                {
                    "kanji": "申告",
                    "hiragana": "しんこく",
                    "priority": 1
                }
            ],
            "てつづ": [
                {
                    "kanji": "簡易",
                    "hiragana": "てつづ",
                    "priority": 1
                }
            ],
            "せいど": [
                {
                    "kanji": "制度",
                    "hiragana": "せいど",
                    "priority": 1
                }
            ],
            "しょうけんがいしゃ": [
                {
                    "kanji": "証券会社",
                    "hiragana": "しょうけんがいしゃ",
                    "priority": 1
                }
            ],
            "めいがら": [
                {
                    "kanji": "銘柄",
                    "hiragana": "めいがら",
                    "priority": 1
                }
            ],
            "しゅとく": [
                {
                    "kanji": "取得",
                    "hiragana": "しゅとく",
                    "priority": 1
                }
            ],
            "かがく": [
                {
                    "kanji": "価額",
                    "hiragana": "かがく",
                    "priority": 1
                }
            ],
            "しんこくしょ": [
                {
                    "kanji": "申告書",
                    "hiragana": "しんこくしょ",
                    "priority": 1
                }
            ],
            "てんぷ": [
                {
                    "kanji": "添付",
                    "hiragana": "てんぷ",
                    "priority": 1
                }
            ],
            "がいこく": [
                {
                    "kanji": "外国",
                    "hiragana": "がいこく",
                    "priority": 1
                }
            ],
            "かわせ": [
                {
                    "kanji": "為替",
                    "hiragana": "かわせ",
                    "priority": 1
                }
            ],
            "しょうこきん": [
                {
                    "kanji": "証拠金",
                    "hiragana": "しょうこきん",
                    "priority": 1
                }
            ],
            "とりひき": [
                {
                    "kanji": "取引",
                    "hiragana": "とりひき",
                    "priority": 1
                }
            ],
            "ぎょうしゃ": [
                {
                    "kanji": "業者",
                    "hiragana": "ぎょうしゃ",
                    "priority": 1
                }
            ],
            "そんざい": [
                {
                    "kanji": "存在",
                    "hiragana": "そんざい",
                    "priority": 1
                }
            ],
            "でんじゅ": [
                {
                    "kanji": "伝授",
                    "hiragana": "でんじゅ",
                    "priority": 1
                }
            ],
            "せきにん": [
                {
                    "kanji": "責任",
                    "hiragana": "せきにん",
                    "priority": 1
                }
            ],
            "ほいくし": [
                {
                    "kanji": "保育士",
                    "hiragana": "ほいくし",
                    "priority": 1
                }
            ],
            "とまど": [
                {
                    "kanji": "戸惑",
                    "hiragana": "とまど",
                    "priority": 1
                }
            ],
            "ふあん": [
                {
                    "kanji": "不安",
                    "hiragana": "ふあん",
                    "priority": 1
                }
            ],
            "ささ": [
                {
                    "kanji": "支",
                    "hiragana": "ささ",
                    "priority": 1
                }
            ],
            "まわ": [
                {
                    "kanji": "周",
                    "hiragana": "まわ",
                    "priority": 1
                }
            ],
            "さまざま": [
                {
                    "kanji": "様々",
                    "hiragana": "さまざま",
                    "priority": 1
                }
            ],
            "むじんとう": [
                {
                    "kanji": "無人島",
                    "hiragana": "むじんとう",
                    "priority": 1
                }
            ],
            "ひとあじ": [
                {
                    "kanji": "一味",
                    "hiragana": "ひとあじ",
                    "priority": 1
                }
            ],
            "さか": [
                {
                    "kanji": "盛",
                    "hiragana": "さか",
                    "priority": 1
                }
            ],
            "ひょうか": [
                {
                    "kanji": "評価",
                    "hiragana": "ひょうか",
                    "priority": 1
                },
                {
                    "kanji": "対象",
                    "hiragana": "ひょうか",
                    "priority": 1
                }
            ],
            "じったいけん": [
                {
                    "kanji": "実体験",
                    "hiragana": "じったいけん",
                    "priority": 1
                }
            ],
            "もと": [
                {
                    "kanji": "基",
                    "hiragana": "もと",
                    "priority": 1
                }
            ],
            "どなた": [
                {
                    "kanji": "参加",
                    "hiragana": "どなた",
                    "priority": 1
                }
            ],
            "がぞう": [
                {
                    "kanji": "画像",
                    "hiragana": "がぞう",
                    "priority": 1
                }
            ],
            "かのう": [
                {
                    "kanji": "可能",
                    "hiragana": "かのう",
                    "priority": 1
                }
            ],
            "へんこう": [
                {
                    "kanji": "変更",
                    "hiragana": "へんこう",
                    "priority": 1
                }
            ],
            "さくじょ": [
                {
                    "kanji": "削除",
                    "hiragana": "さくじょ",
                    "priority": 1
                }
            ],
            "あき": [
                {
                    "kanji": "秋",
                    "hiragana": "あき",
                    "priority": 1
                }
            ],
            "ぎょうあん": [
                {
                    "kanji": "暁闇",
                    "hiragana": "ぎょうあん",
                    "priority": 1
                }
            ],
            "たそがれ": [
                {
                    "kanji": "黄昏",
                    "hiragana": "たそがれ",
                    "priority": 1
                }
            ],
            "ゆく": [
                {
                    "kanji": "行",
                    "hiragana": "ゆく",
                    "priority": 1
                },
                {
                    "kanji": "行く",
                    "hiragana": "ゆく",
                    "priority": 1
                }
            ],
            "うしゅう": [
                {
                    "kanji": "憂愁",
                    "hiragana": "うしゅう",
                    "priority": 1
                }
            ],
            "なげる": [
                {
                    "kanji": "投げる",
                    "hiragana": "なげる",
                    "priority": 1
                }
            ],
            "ころ": [
                {
                    "kanji": "頃",
                    "hiragana": "ころ",
                    "priority": 1
                }
            ],
            "ものさび": [
                {
                    "kanji": "物寂",
                    "hiragana": "ものさび",
                    "priority": 1
                }
            ],
            "しょうよう": [
                {
                    "kanji": "逍遥",
                    "hiragana": "しょうよう",
                    "priority": 1
                }
            ],
            "ふる": [
                {
                    "kanji": "古",
                    "hiragana": "ふる",
                    "priority": 1
                }
            ],
            "だいがらん": [
                {
                    "kanji": "大伽藍",
                    "hiragana": "だいがらん",
                    "priority": 1
                }
            ],
            "そうごん": [
                {
                    "kanji": "荘厳",
                    "hiragana": "そうごん",
                    "priority": 1
                }
            ],
            "きせつ": [
                {
                    "kanji": "季節",
                    "hiragana": "きせつ",
                    "priority": 1
                }
            ],
            "かんかく": [
                {
                    "kanji": "感覚",
                    "hiragana": "かんかく",
                    "priority": 1
                }
            ],
            "むかし": [
                {
                    "kanji": "昔",
                    "hiragana": "むかし",
                    "priority": 1
                }
            ],
            "すぎさ": [
                {
                    "kanji": "過ぎ去",
                    "hiragana": "すぎさ",
                    "priority": 1
                }
            ],
            "やみ": [
                {
                    "kanji": "闇",
                    "hiragana": "やみ",
                    "priority": 1
                }
            ],
            "ひく": [
                {
                    "kanji": "低",
                    "hiragana": "ひく",
                    "priority": 1
                }
            ],
            "えんてんじょう": [
                {
                    "kanji": "円天井",
                    "hiragana": "えんてんじょう",
                    "priority": 1
                }
            ],
            "なが": [
                {
                    "kanji": "長",
                    "hiragana": "なが",
                    "priority": 1
                }
            ],
            "ろうか": [
                {
                    "kanji": "廊下",
                    "hiragana": "ろうか",
                    "priority": 1
                }
            ],
            "とお": [
                {
                    "kanji": "通",
                    "hiragana": "とお",
                    "priority": 1
                }
            ],
            "きょだい": [
                {
                    "kanji": "巨大",
                    "hiragana": "きょだい",
                    "priority": 1
                }
            ],
            "かべ": [
                {
                    "kanji": "壁",
                    "hiragana": "かべ",
                    "priority": 1
                }
            ],
            "えんけい": [
                {
                    "kanji": "円形",
                    "hiragana": "えんけい",
                    "priority": 1
                }
            ],
            "あな": [
                {
                    "kanji": "穴",
                    "hiragana": "あな",
                    "priority": 1
                }
            ],
            "ちか": [
                {
                    "kanji": "地下",
                    "hiragana": "ちか",
                    "priority": 1
                }
            ],
            "もぐ": [
                {
                    "kanji": "潜",
                    "hiragana": "もぐ",
                    "priority": 1
                }
            ],
            "くら": [
                {
                    "kanji": "暗",
                    "hiragana": "くら",
                    "priority": 1
                }
            ],
            "せいどう": [
                {
                    "kanji": "聖堂",
                    "hiragana": "せいどう",
                    "priority": 1
                }
            ],
            "まも": [
                {
                    "kanji": "守",
                    "hiragana": "まも",
                    "priority": 1
                }
            ],
            "おい": [
                {
                    "kanji": "老",
                    "hiragana": "おい",
                    "priority": 1
                }
            ],
            "くろ": [
                {
                    "kanji": "黒",
                    "hiragana": "くろ",
                    "priority": 1
                }
            ],
            "ころも": [
                {
                    "kanji": "衣",
                    "hiragana": "ころも",
                    "priority": 1
                }
            ],
            "まと": [
                {
                    "kanji": "姿",
                    "hiragana": "まと",
                    "priority": 1
                }
            ],
            "うすぐら": [
                {
                    "kanji": "薄暗",
                    "hiragana": "うすぐら",
                    "priority": 1
                }
            ],
            "ぼち": [
                {
                    "kanji": "墓地",
                    "hiragana": "ぼち",
                    "priority": 1
                }
            ],
            "ゆうれい": [
                {
                    "kanji": "幽霊",
                    "hiragana": "ゆうれい",
                    "priority": 1
                }
            ],
            "ひまだし": [
                {
                    "kanji": "暇だし",
                    "hiragana": "ひまだし",
                    "priority": 1
                }
            ],
            "どこか": [
                {
                    "kanji": "何処か",
                    "hiragana": "どこか",
                    "priority": 1
                }
            ],
            "いかない": [
                {
                    "kanji": "行かない",
                    "hiragana": "いかない",
                    "priority": 1
                }
            ],
            "どうさ": [
                {
                    "kanji": "動作",
                    "hiragana": "どうさ",
                    "priority": 1
                }
            ],
            "じっけん": [
                {
                    "kanji": "実験",
                    "hiragana": "じっけん",
                    "priority": 1
                }
            ],
            "どう": [
                {
                    "kanji": "どう",
                    "hiragana": "どう",
                    "priority": 1
                }
            ],
            "なん": [
                {
                    "kanji": "何",
                    "hiragana": "なん",
                    "priority": 1
                }
            ],
            "かつようご": [
                {
                    "kanji": "活用語",
                    "hiragana": "かつようご",
                    "priority": 1
                }
            ],
            "むかう": [
                {
                    "kanji": "向かう",
                    "hiragana": "むかう",
                    "priority": 1
                }
            ],
            "なかにわ": [
                {
                    "kanji": "中庭",
                    "hiragana": "なかにわ",
                    "priority": 1
                }
            ],
            "しょうげき": [
                {
                    "kanji": "衝撃",
                    "hiragana": "しょうげき",
                    "priority": 1
                }
            ],
            "てきな": [
                {
                    "kanji": "的な",
                    "hiragana": "てきな",
                    "priority": 1
                }
            ],
            "けっか": [
                {
                    "kanji": "結果",
                    "hiragana": "けっか",
                    "priority": 1
                }
            ],
            "なった": [
                {
                    "kanji": "なった",
                    "hiragana": "なった",
                    "priority": 1
                }
            ],
            "なこと": [
                {
                    "kanji": "なこと",
                    "hiragana": "なこと",
                    "priority": 1
                }
            ],
            "おきる": [
                {
                    "kanji": "起きる",
                    "hiragana": "おきる",
                    "priority": 1
                }
            ],
            "おきま": [
                {
                    "kanji": "起きま",
                    "hiragana": "おきま",
                    "priority": 1
                }
            ],
            "すごく": [
                {
                    "kanji": "凄く",
                    "hiragana": "すごく",
                    "priority": 1
                }
            ],
            "けど": [
                {
                    "kanji": "けど",
                    "hiragana": "けど",
                    "priority": 1
                }
            ],
            "しんぱいていし": [
                {
                    "kanji": "心肺停止",
                    "hiragana": "しんぱいていし",
                    "priority": 1
                }
            ],
            "いんうつ": [
                {
                    "kanji": "陰鬱",
                    "hiragana": "いんうつ",
                    "priority": 1
                }
            ],
            "そういん": [
                {
                    "kanji": "僧院",
                    "hiragana": "そういん",
                    "priority": 1
                }
            ],
            "あと": [
                {
                    "kanji": "跡",
                    "hiragana": "あと",
                    "priority": 1
                },
                {
                    "kanji": "後",
                    "hiragana": "あと",
                    "priority": 1
                }
            ],
            "おのずから": [
                {
                    "kanji": "自ずから",
                    "hiragana": "おのずから",
                    "priority": 1
                }
            ],
            "しさく": [
                {
                    "kanji": "思索",
                    "hiragana": "しさく",
                    "priority": 1
                }
            ],
            "ふさわしい": [
                {
                    "kanji": "相応しい",
                    "hiragana": "ふさわしい",
                    "priority": 1
                }
            ],
            "きもち": [
                {
                    "kanji": "気持ち",
                    "hiragana": "きもち",
                    "priority": 1
                }
            ],
            "かいろう": [
                {
                    "kanji": "廻廊",
                    "hiragana": "かいろう",
                    "priority": 1
                }
            ],
            "むかしながら": [
                {
                    "kanji": "昔ながら",
                    "hiragana": "むかしながら",
                    "priority": 1
                }
            ],
            "せけん": [
                {
                    "kanji": "世間",
                    "hiragana": "せけん",
                    "priority": 1
                }
            ],
            "しずけさ": [
                {
                    "kanji": "静寂",
                    "hiragana": "しずけさ",
                    "priority": 1
                }
            ],
            "おもかげ": [
                {
                    "kanji": "面影",
                    "hiragana": "おもかげ",
                    "priority": 1
                }
            ],
            "とどめて": [
                {
                    "kanji": "留めて",
                    "hiragana": "とどめて",
                    "priority": 1
                }
            ],
            "はいいろ": [
                {
                    "kanji": "灰色",
                    "hiragana": "はいいろ",
                    "priority": 1
                }
            ],
            "しっけ": [
                {
                    "kanji": "湿気",
                    "hiragana": "しっけ",
                    "priority": 1
                }
            ],
            "くずれおちそう": [
                {
                    "kanji": "崩れ落ちそう",
                    "hiragana": "くずれおちそう",
                    "priority": 1
                }
            ],
            "こけ": [
                {
                    "kanji": "苔",
                    "hiragana": "こけ",
                    "priority": 1
                }
            ],
            "はめこんだ": [
                {
                    "kanji": "嵌め込んだ",
                    "hiragana": "はめこんだ",
                    "priority": 1
                }
            ],
            "きねんひ": [
                {
                    "kanji": "記念碑",
                    "hiragana": "きねんひ",
                    "priority": 1
                }
            ],
            "ひぶん": [
                {
                    "kanji": "碑文",
                    "hiragana": "ひぶん",
                    "priority": 1
                }
            ],
            "おおい": [
                {
                    "kanji": "覆い",
                    "hiragana": "おおい",
                    "priority": 1
                }
            ],
            "されこうべ": [
                {
                    "kanji": "髑髏",
                    "hiragana": "されこうべ",
                    "priority": 1
                }
            ],
            "せいこうな": [
                {
                    "kanji": "精巧な",
                    "hiragana": "せいこうな",
                    "priority": 1
                }
            ],
            "ちょうこく": [
                {
                    "kanji": "彫刻",
                    "hiragana": "ちょうこく",
                    "priority": 1
                }
            ],
            "ほどこした": [
                {
                    "kanji": "施した",
                    "hiragana": "ほどこした",
                    "priority": 1
                }
            ],
            "はざま": [
                {
                    "kanji": "狭間",
                    "hiragana": "はざま",
                    "priority": 1
                }
            ],
            "かざり": [
                {
                    "kanji": "飾り",
                    "hiragana": "かざり",
                    "priority": 1
                }
            ],
            "ばら": [
                {
                    "kanji": "薔薇",
                    "hiragana": "ばら",
                    "priority": 1
                }
            ],
            "かなめいし": [
                {
                    "kanji": "要石",
                    "hiragana": "かなめいし",
                    "priority": 1
                }
            ],
            "もよう": [
                {
                    "kanji": "模様",
                    "hiragana": "もよう",
                    "priority": 1
                }
            ],
            "しげる": [
                {
                    "kanji": "茂る",
                    "hiragana": "しげる",
                    "priority": 1
                }
            ],
            "いくせいそう": [
                {
                    "kanji": "幾星霜",
                    "hiragana": "いくせいそう",
                    "priority": 1
                }
            ],
            "しんしょく": [
                {
                    "kanji": "侵蝕",
                    "hiragana": "しんしょく",
                    "priority": 1
                }
            ],
            "ほろび": [
                {
                    "kanji": "滅び",
                    "hiragana": "ほろび",
                    "priority": 1
                }
            ],
            "あいしゅう": [
                {
                    "kanji": "哀愁",
                    "hiragana": "あいしゅう",
                    "priority": 1
                }
            ],
            "たのしく": [
                {
                    "kanji": "楽しく",
                    "hiragana": "たのしく",
                    "priority": 1
                }
            ],
            "ぎもん": [
                {
                    "kanji": "疑問",
                    "hiragana": "ぎもん",
                    "priority": 1
                }
            ],
            "しょうじき": [
                {
                    "kanji": "正直",
                    "hiragana": "しょうじき",
                    "priority": 1
                }
            ],
            "やまだ": [
                {
                    "kanji": "山田",
                    "hiragana": "やまだ",
                    "priority": 1
                }
            ],
            "すかれる": [
                {
                    "kanji": "好かれる",
                    "hiragana": "すかれる",
                    "priority": 1
                }
            ],
            "ももやまじだい": [
                {
                    "kanji": "桃山時代",
                    "hiragana": "ももやまじだい",
                    "priority": 1
                }
            ],
            "さくひん": [
                {
                    "kanji": "作品",
                    "hiragana": "さくひん",
                    "priority": 1
                }
            ],
            "しょうわ": [
                {
                    "kanji": "昭和",
                    "hiragana": "しょうわ",
                    "priority": 1
                }
            ],
            "えいが": [
                {
                    "kanji": "映画",
                    "hiragana": "えいが",
                    "priority": 1
                }
            ],
            "かとう": [
                {
                    "kanji": "勝とう",
                    "hiragana": "かとう",
                    "priority": 1
                }
            ],
            "かごん": [
                {
                    "kanji": "過言",
                    "hiragana": "かごん",
                    "priority": 1
                }
            ],
            "なっとく": [
                {
                    "kanji": "納得",
                    "hiragana": "なっとく",
                    "priority": 1
                }
            ],
            "ごじゅうじかん": [
                {
                    "kanji": "五十時間",
                    "hiragana": "ごじゅうじかん",
                    "priority": 1
                }
            ],
            "おしい": [
                {
                    "kanji": "惜しい",
                    "hiragana": "おしい",
                    "priority": 1
                }
            ],
            "こうそく": [
                {
                    "kanji": "高速",
                    "hiragana": "こうそく",
                    "priority": 1
                }
            ],
            "とおまわり": [
                {
                    "kanji": "遠回り",
                    "hiragana": "とおまわり",
                    "priority": 1
                }
            ],
            "むなしい": [
                {
                    "kanji": "虚しい",
                    "hiragana": "むなしい",
                    "priority": 1
                }
            ],
            "かお": [
                {
                    "kanji": "顔",
                    "hiragana": "かお",
                    "priority": 1
                }
            ],
            "けいかくあん": [
                {
                    "kanji": "計画案",
                    "hiragana": "けいかくあん",
                    "priority": 1
                }
            ],
            "ていしゅつきげん": [
                {
                    "kanji": "提出期限",
                    "hiragana": "ていしゅつきげん",
                    "priority": 1
                }
            ],
            "いちねんいない": [
                {
                    "kanji": "一年以内",
                    "hiragana": "いちねんいない",
                    "priority": 1
                }
            ],
            "おもい": [
                {
                    "kanji": "思い",
                    "hiragana": "おもい",
                    "priority": 1
                }
            ],
            "さんこう": [
                {
                    "kanji": "参考",
                    "hiragana": "さんこう",
                    "priority": 1
                }
            ],
            "たおれる": [
                {
                    "kanji": "倒れる",
                    "hiragana": "たおれる",
                    "priority": 1
                }
            ],
            "おと": [
                {
                    "kanji": "音",
                    "hiragana": "おと",
                    "priority": 1
                }
            ],
            "どりょく": [
                {
                    "kanji": "努力",
                    "hiragana": "どりょく",
                    "priority": 1
                }
            ],
            "たんじょうび": [
                {
                    "kanji": "誕生日",
                    "hiragana": "たんじょうび",
                    "priority": 1
                }
            ],
            "じゅんび": [
                {
                    "kanji": "準備",
                    "hiragana": "じゅんび",
                    "priority": 1
                }
            ],
            "にんちしょう": [
                {
                    "kanji": "認知症",
                    "hiragana": "にんちしょう",
                    "priority": 1
                }
            ],
            "わずらった": [
                {
                    "kanji": "患った",
                    "hiragana": "わずらった",
                    "priority": 1
                }
            ],
            "きょうどうせいかつ": [
                {
                    "kanji": "共同生活",
                    "hiragana": "きょうどうせいかつ",
                    "priority": 1
                }
            ],
            "ことば": [
                {
                    "kanji": "言葉",
                    "hiragana": "ことば",
                    "priority": 1
                }
            ],
            "みみ": [
                {
                    "kanji": "耳",
                    "hiragana": "みみ",
                    "priority": 1
                }
            ],
            "せんべつ": [
                {
                    "kanji": "選別",
                    "hiragana": "せんべつ",
                    "priority": 1
                }
            ],
            "ぎょうむ": [
                {
                    "kanji": "業務",
                    "hiragana": "ぎょうむ",
                    "priority": 1
                }
            ],
            "ざんぞんきかん": [
                {
                    "kanji": "残存期間",
                    "hiragana": "ざんぞんきかん",
                    "priority": 1
                }
            ],
            "ひつよう": [
                {
                    "kanji": "必要",
                    "hiragana": "ひつよう",
                    "priority": 1
                }
            ],
            "くち": [
                {
                    "kanji": "口",
                    "hiragana": "くち",
                    "priority": 1
                }
            ],
            "うた": [
                {
                    "kanji": "歌",
                    "hiragana": "うた",
                    "priority": 1
                }
            ],
            "れんしゅう": [
                {
                    "kanji": "練習",
                    "hiragana": "れんしゅう",
                    "priority": 1
                }
            ],
            "せかいりくじょう": [
                {
                    "kanji": "世界陸上",
                    "hiragana": "せかいりくじょう",
                    "priority": 1
                }
            ],
            "きっぷ": [
                {
                    "kanji": "切符",
                    "hiragana": "きっぷ",
                    "priority": 1
                }
            ],
            "つま": [
                {
                    "kanji": "妻",
                    "hiragana": "つま",
                    "priority": 1
                }
            ],
            "かいもの": [
                {
                    "kanji": "買い物",
                    "hiragana": "かいもの",
                    "priority": 1
                }
            ],
            "うつしがえ": [
                {
                    "kanji": "移し変え",
                    "hiragana": "うつしがえ",
                    "priority": 1
                }
            ],
            "びょう": [
                {
                    "kanji": "秒",
                    "hiragana": "びょう",
                    "priority": 1
                }
            ],
            "きゅうにん": [
                {
                    "kanji": "9人",
                    "hiragana": "きゅうにん",
                    "priority": 1
                }
            ],
            "ちゅうがっこう": [
                {
                    "kanji": "中学校",
                    "hiragana": "ちゅうがっこう",
                    "priority": 1
                }
            ],
            "ねんせい": [
                {
                    "kanji": "年生",
                    "hiragana": "ねんせい",
                    "priority": 1
                }
            ],
            "しょくばたいけん": [
                {
                    "kanji": "職場体験",
                    "hiragana": "しょくばたいけん",
                    "priority": 1
                }
            ],
            "えいご": [
                {
                    "kanji": "英語",
                    "hiragana": "えいご",
                    "priority": 1
                }
            ],
            "べんきょう": [
                {
                    "kanji": "勉強",
                    "hiragana": "べんきょう",
                    "priority": 1
                }
            ],
            "せんせい": [
                {
                    "kanji": "先生",
                    "hiragana": "せんせい",
                    "priority": 1
                }
            ],
            "しつもん": [
                {
                    "kanji": "質問",
                    "hiragana": "しつもん",
                    "priority": 1
                }
            ],
            "はじめて": [
                {
                    "kanji": "初めて",
                    "hiragana": "はじめて",
                    "priority": 1
                }
            ],
            "めいわくこうい": [
                {
                    "kanji": "迷惑行為",
                    "hiragana": "めいわくこうい",
                    "priority": 1
                }
            ],
            "いそがしく": [
                {
                    "kanji": "忙しく",
                    "hiragana": "いそがしく",
                    "priority": 1
                }
            ],
            "よかん": [
                {
                    "kanji": "予感",
                    "hiragana": "よかん",
                    "priority": 1
                }
            ],
            "そつぎょうしょうしょ": [
                {
                    "kanji": "卒業証書",
                    "hiragana": "そつぎょうしょうしょ",
                    "priority": 1
                }
            ],
            "みせ": [
                {
                    "kanji": "店員",
                    "hiragana": "みせ",
                    "priority": 1
                },
                {
                    "kanji": "店",
                    "hiragana": "みせ",
                    "priority": 1
                }
            ],
            "きゃく": [
                {
                    "kanji": "客",
                    "hiragana": "きゃく",
                    "priority": 1
                }
            ],
            "しょうひん": [
                {
                    "kanji": "商品",
                    "hiragana": "しょうひん",
                    "priority": 1
                }
            ],
            "せつめい": [
                {
                    "kanji": "説明",
                    "hiragana": "せつめい",
                    "priority": 1
                }
            ],
            "よぼう": [
                {
                    "kanji": "予防",
                    "hiragana": "よぼう",
                    "priority": 1
                }
            ],
            "はたらき": [
                {
                    "kanji": "働き",
                    "hiragana": "はたらき",
                    "priority": 1
                }
            ],
            "べっぴょう": [
                {
                    "kanji": "別表",
                    "hiragana": "べっぴょう",
                    "priority": 1
                }
            ],
            "だいいち": [
                {
                    "kanji": "第一",
                    "hiragana": "だいいち",
                    "priority": 1
                }
            ],
            "よさん": [
                {
                    "kanji": "予算",
                    "hiragana": "よさん",
                    "priority": 1
                }
            ],
            "そうがく": [
                {
                    "kanji": "総額",
                    "hiragana": "そうがく",
                    "priority": 1
                }
            ],
            "おく": [
                {
                    "kanji": "億",
                    "hiragana": "おく",
                    "priority": 1
                }
            ],
            "てき": [
                {
                    "kanji": "敵",
                    "hiragana": "てき",
                    "priority": 1
                }
            ],
            "かいめつじょうたい": [
                {
                    "kanji": "壊滅状態",
                    "hiragana": "かいめつじょうたい",
                    "priority": 1
                }
            ],
            "かたち": [
                {
                    "kanji": "形",
                    "hiragana": "かたち",
                    "priority": 1
                }
            ],
            "りんしょうてきけんきゅう": [
                {
                    "kanji": "臨床的研究",
                    "hiragana": "りんしょうてきけんきゅう",
                    "priority": 1
                }
            ],
            "はってん": [
                {
                    "kanji": "発展",
                    "hiragana": "はってん",
                    "priority": 1
                }
            ],
            "こうじょう": [
                {
                    "kanji": "向上",
                    "hiragana": "こうじょう",
                    "priority": 1
                }
            ],
            "もくてき": [
                {
                    "kanji": "目的",
                    "hiragana": "もくてき",
                    "priority": 1
                }
            ],
            "れんま": [
                {
                    "kanji": "錬磨",
                    "hiragana": "れんま",
                    "priority": 1
                }
            ],
            "いくせい": [
                {
                    "kanji": "育成",
                    "hiragana": "いくせい",
                    "priority": 1
                }
            ],
            "くふう": [
                {
                    "kanji": "工夫",
                    "hiragana": "くふう",
                    "priority": 1
                }
            ],
            "いいんかい": [
                {
                    "kanji": "委員会",
                    "hiragana": "いいんかい",
                    "priority": 1
                }
            ],
            "けいけん": [
                {
                    "kanji": "経験",
                    "hiragana": "けいけん",
                    "priority": 1
                }
            ],
            "いいかた": [
                {
                    "kanji": "言い方",
                    "hiragana": "いいかた",
                    "priority": 1
                }
            ],
            "こども": [
                {
                    "kanji": "子供",
                    "hiragana": "こども",
                    "priority": 1
                }
            ],
            "だいひょう": [
                {
                    "kanji": "代表",
                    "hiragana": "だいひょう",
                    "priority": 1
                }
            ],
            "おや": [
                {
                    "kanji": "親",
                    "hiragana": "おや",
                    "priority": 1
                }
            ],
            "そふぼ": [
                {
                    "kanji": "祖父母",
                    "hiragana": "そふぼ",
                    "priority": 1
                }
            ],
            "あいさつ": [
                {
                    "kanji": "挨拶",
                    "hiragana": "あいさつ",
                    "priority": 1
                }
            ],
            "はなこ": [
                {
                    "kanji": "花子",
                    "hiragana": "はなこ",
                    "priority": 1
                }
            ],
            "へんじ": [
                {
                    "kanji": "返事",
                    "hiragana": "へんじ",
                    "priority": 1
                }
            ],
            "むり": [
                {
                    "kanji": "無理",
                    "hiragana": "むり",
                    "priority": 1
                }
            ],
            "かいしゃ": [
                {
                    "kanji": "会社",
                    "hiragana": "かいしゃ",
                    "priority": 1
                }
            ],
            "とうろく": [
                {
                    "kanji": "登録",
                    "hiragana": "とうろく",
                    "priority": 1
                }
            ],
            "かんていし": [
                {
                    "kanji": "鑑定士",
                    "hiragana": "かんていし",
                    "priority": 1
                }
            ],
            "しかく": [
                {
                    "kanji": "資格",
                    "hiragana": "しかく",
                    "priority": 1
                }
            ],
            "けんさ": [
                {
                    "kanji": "検査",
                    "hiragana": "けんさ",
                    "priority": 1
                }
            ],
            "かいわ": [
                {
                    "kanji": "会話",
                    "hiragana": "かいわ",
                    "priority": 1
                }
            ],
            "はつげん": [
                {
                    "kanji": "発言",
                    "hiragana": "はつげん",
                    "priority": 1
                }
            ],
            "こうどう": [
                {
                    "kanji": "行動",
                    "hiragana": "こうどう",
                    "priority": 1
                }
            ],
            "つるしきり": [
                {
                    "kanji": "吊るし切り",
                    "hiragana": "つるしきり",
                    "priority": 1
                }
            ],
            "かおり": [
                {
                    "kanji": "香り",
                    "hiragana": "かおり",
                    "priority": 1
                }
            ],
            "しょり": [
                {
                    "kanji": "処理",
                    "hiragana": "しょり",
                    "priority": 1
                }
            ],
            "しゅうにゅう": [
                {
                    "kanji": "収入",
                    "hiragana": "しゅうにゅう",
                    "priority": 1
                }
            ],
            "やくそく": [
                {
                    "kanji": "約束",
                    "hiragana": "やくそく",
                    "priority": 1
                }
            ],
            "うごき": [
                {
                    "kanji": "動き",
                    "hiragana": "うごき",
                    "priority": 1
                }
            ],
            "いもうと": [
                {
                    "kanji": "妹",
                    "hiragana": "いもうと",
                    "priority": 1
                }
            ],
            "こい": [
                {
                    "kanji": "恋",
                    "hiragana": "こい",
                    "priority": 1
                }
            ],
            "たび": [
                {
                    "kanji": "旅",
                    "hiragana": "たび",
                    "priority": 1
                }
            ],
            "ないよう": [
                {
                    "kanji": "内容",
                    "hiragana": "ないよう",
                    "priority": 1
                }
            ],
            "かくにん": [
                {
                    "kanji": "確認",
                    "hiragana": "かくにん",
                    "priority": 1
                }
            ],
            "ひょうじょう": [
                {
                    "kanji": "表情",
                    "hiragana": "ひょうじょう",
                    "priority": 1
                }
            ],
            "じょそう": [
                {
                    "kanji": "女装",
                    "hiragana": "じょそう",
                    "priority": 1
                }
            ],
            "ひそかに": [
                {
                    "kanji": "密かに",
                    "hiragana": "ひそかに",
                    "priority": 1
                }
            ],
            "たのしむ": [
                {
                    "kanji": "楽しむ",
                    "hiragana": "たのしむ",
                    "priority": 1
                }
            ],
            "たいしょう": [
                {
                    "kanji": "対象",
                    "hiragana": "たいしょう",
                    "priority": 1
                },
                {
                    "kanji": "大将",
                    "hiragana": "たいしょう",
                    "priority": 1
                }
            ],
            "じょうほう": [
                {
                    "kanji": "情報",
                    "hiragana": "じょうほう",
                    "priority": 1
                }
            ],
            "こうかん": [
                {
                    "kanji": "交換",
                    "hiragana": "こうかん",
                    "priority": 1
                }
            ],
            "あじ": [
                {
                    "kanji": "味",
                    "hiragana": "あじ",
                    "priority": 1
                }
            ],
            "じゅうしょへんこう": [
                {
                    "kanji": "住所変更",
                    "hiragana": "じゅうしょへんこう",
                    "priority": 1
                }
            ],
            "てつづき": [
                {
                    "kanji": "手続",
                    "hiragana": "てつづき",
                    "priority": 1
                }
            ],
            "ほうどうきかん": [
                {
                    "kanji": "報道機関",
                    "hiragana": "ほうどうきかん",
                    "priority": 1
                }
            ],
            "ちょうさ": [
                {
                    "kanji": "調査",
                    "hiragana": "ちょうさ",
                    "priority": 1
                }
            ],
            "ぬま": [
                {
                    "kanji": "沼",
                    "hiragana": "ぬま",
                    "priority": 1
                }
            ],
            "そうじ": [
                {
                    "kanji": "掃除",
                    "hiragana": "そうじ",
                    "priority": 1
                }
            ],
            "けんちくがいしゃ": [
                {
                    "kanji": "建築会社",
                    "hiragana": "けんちくがいしゃ",
                    "priority": 1
                }
            ],
            "あしばかんけい": [
                {
                    "kanji": "足場関係",
                    "hiragana": "あしばかんけい",
                    "priority": 1
                }
            ],
            "しごと": [
                {
                    "kanji": "仕事",
                    "hiragana": "しごと",
                    "priority": 1
                }
            ],
            "せってい": [
                {
                    "kanji": "設定",
                    "hiragana": "せってい",
                    "priority": 1
                }
            ],
            "こうじょうしゅっかじ": [
                {
                    "kanji": "工場出荷時",
                    "hiragana": "こうじょうしゅっかじ",
                    "priority": 1
                }
            ],
            "すごい": [
                {
                    "kanji": "凄い",
                    "hiragana": "すごい",
                    "priority": 1
                }
            ],
            "はなし": [
                {
                    "kanji": "話し",
                    "hiragana": "はなし",
                    "priority": 1
                }
            ],
            "ねんれい": [
                {
                    "kanji": "年齢",
                    "hiragana": "ねんれい",
                    "priority": 1
                }
            ],
            "たいおう": [
                {
                    "kanji": "対応",
                    "hiragana": "たいおう",
                    "priority": 1
                }
            ],
            "ちりょう": [
                {
                    "kanji": "治療",
                    "hiragana": "ちりょう",
                    "priority": 1
                }
            ],
            "ゆうしょくづくり": [
                {
                    "kanji": "夕食作り",
                    "hiragana": "ゆうしょくづくり",
                    "priority": 1
                }
            ],
            "かしづくり": [
                {
                    "kanji": "菓子作り",
                    "hiragana": "かしづくり",
                    "priority": 1
                }
            ],
            "つり": [
                {
                    "kanji": "釣り",
                    "hiragana": "つり",
                    "priority": 1
                }
            ],
            "におい": [
                {
                    "kanji": "匂い",
                    "hiragana": "におい",
                    "priority": 1
                }
            ],
            "はきけ": [
                {
                    "kanji": "吐き気",
                    "hiragana": "はきけ",
                    "priority": 1
                }
            ],
            "どうよう": [
                {
                    "kanji": "同様",
                    "hiragana": "どうよう",
                    "priority": 1
                }
            ],
            "ぎろん": [
                {
                    "kanji": "議論",
                    "hiragana": "ぎろん",
                    "priority": 1
                }
            ],
            "がくふ": [
                {
                    "kanji": "楽譜",
                    "hiragana": "がくふ",
                    "priority": 1
                }
            ],
            "かいな": [
                {
                    "kanji": "階名",
                    "hiragana": "かいな",
                    "priority": 1
                }
            ],
            "あいて": [
                {
                    "kanji": "相手",
                    "hiragana": "あいて",
                    "priority": 1
                }
            ],
            "くちびる": [
                {
                    "kanji": "唇",
                    "hiragana": "くちびる",
                    "priority": 1
                }
            ],
            "しあい": [
                {
                    "kanji": "試合",
                    "hiragana": "しあい",
                    "priority": 1
                }
            ],
            "かかり": [
                {
                    "kanji": "係",
                    "hiragana": "かかり",
                    "priority": 1
                }
            ],
            "ちぇっく": [
                {
                    "kanji": "チェック",
                    "hiragana": "ちぇっく",
                    "priority": 1
                }
            ],
            "たんとうすたっふ": [
                {
                    "kanji": "担当スタッフ",
                    "hiragana": "たんとうすたっふ",
                    "priority": 1
                }
            ],
            "しょくにん": [
                {
                    "kanji": "職人",
                    "hiragana": "しょくにん",
                    "priority": 1
                }
            ],
            "うちあわせ": [
                {
                    "kanji": "打合せ",
                    "hiragana": "うちあわせ",
                    "priority": 1
                }
            ],
            "みずあそび": [
                {
                    "kanji": "水遊び",
                    "hiragana": "みずあそび",
                    "priority": 1
                }
            ],
            "まね": [
                {
                    "kanji": "真似",
                    "hiragana": "まね",
                    "priority": 1
                }
            ],
            "ほうもんしどう": [
                {
                    "kanji": "訪問指導",
                    "hiragana": "ほうもんしどう",
                    "priority": 1
                }
            ],
            "きねんさつえい": [
                {
                    "kanji": "記念撮影",
                    "hiragana": "きねんさつえい",
                    "priority": 1
                }
            ],
            "りょこう": [
                {
                    "kanji": "旅行",
                    "hiragana": "りょこう",
                    "priority": 1
                }
            ],
            "かんり": [
                {
                    "kanji": "管理",
                    "hiragana": "かんり",
                    "priority": 1
                }
            ],
            "きょうとちく": [
                {
                    "kanji": "京都地区",
                    "hiragana": "きょうとちく",
                    "priority": 1
                }
            ],
            "ちゅうしん": [
                {
                    "kanji": "中心",
                    "hiragana": "ちゅうしん",
                    "priority": 1
                }
            ],
            "きり": [
                {
                    "kanji": "切り",
                    "hiragana": "きり",
                    "priority": 1
                }
            ],
            "しちょう": [
                {
                    "kanji": "市長",
                    "hiragana": "しちょう",
                    "priority": 1
                }
            ],
            "じゅしょうほうこく": [
                {
                    "kanji": "受賞報告",
                    "hiragana": "じゅしょうほうこく",
                    "priority": 1
                }
            ],
            "けいじばん": [
                {
                    "kanji": "掲示板",
                    "hiragana": "けいじばん",
                    "priority": 1
                }
            ],
            "かきこみ": [
                {
                    "kanji": "書き込み",
                    "hiragana": "かきこみ",
                    "priority": 1
                }
            ],
            "かたうで": [
                {
                    "kanji": "片腕",
                    "hiragana": "かたうで",
                    "priority": 1
                }
            ],
            "せんしゅ": [
                {
                    "kanji": "選手",
                    "hiragana": "せんしゅ",
                    "priority": 1
                }
            ],
            "ぷれー": [
                {
                    "kanji": "プレー",
                    "hiragana": "ぷれー",
                    "priority": 1
                }
            ],
            "えどじだい": [
                {
                    "kanji": "江戸時代",
                    "hiragana": "えどじだい",
                    "priority": 1
                }
            ],
            "じつわ": [
                {
                    "kanji": "実話",
                    "hiragana": "じつわ",
                    "priority": 1
                }
            ],
            "きーわーど": [
                {
                    "kanji": "キーワード",
                    "hiragana": "きーわーど",
                    "priority": 1
                }
            ],
            "ほうめん": [
                {
                    "kanji": "方面",
                    "hiragana": "ほうめん",
                    "priority": 1
                }
            ],
            "きょじゅうしゃ": [
                {
                    "kanji": "居住者",
                    "hiragana": "きょじゅうしゃ",
                    "priority": 1
                }
            ],
            "よやく": [
                {
                    "kanji": "予約",
                    "hiragana": "よやく",
                    "priority": 1
                }
            ],
            "だんめん": [
                {
                    "kanji": "断面",
                    "hiragana": "だんめん",
                    "priority": 1
                }
            ],
            "かぞく": [
                {
                    "kanji": "家族",
                    "hiragana": "かぞく",
                    "priority": 1
                }
            ],
            "ふたん": [
                {
                    "kanji": "負担",
                    "hiragana": "ふたん",
                    "priority": 1
                }
            ],
            "けいげん": [
                {
                    "kanji": "軽減",
                    "hiragana": "けいげん",
                    "priority": 1
                }
            ],
            "ていきょう": [
                {
                    "kanji": "提供",
                    "hiragana": "ていきょう",
                    "priority": 1
                }
            ],
            "じょゆう": [
                {
                    "kanji": "女優",
                    "hiragana": "じょゆう",
                    "priority": 1
                }
            ],
            "だんせい": [
                {
                    "kanji": "男性",
                    "hiragana": "だんせい",
                    "priority": 1
                }
            ],
            "にした": [
                {
                    "kanji": "付け",
                    "hiragana": "にした",
                    "priority": 1
                }
            ],
            "けいやく": [
                {
                    "kanji": "契約",
                    "hiragana": "けいやく",
                    "priority": 1
                }
            ],
            "こえ": [
                {
                    "kanji": "声",
                    "hiragana": "こえ",
                    "priority": 1
                }
            ],
            "つかいかた": [
                {
                    "kanji": "使い方",
                    "hiragana": "つかいかた",
                    "priority": 1
                }
            ],
            "ぜんぶ": [
                {
                    "kanji": "全部",
                    "hiragana": "ぜんぶ",
                    "priority": 1
                }
            ],
            "みかた": [
                {
                    "kanji": "見方",
                    "hiragana": "みかた",
                    "priority": 1
                }
            ],
            "こうひょうか": [
                {
                    "kanji": "好評価",
                    "hiragana": "こうひょうか",
                    "priority": 1
                }
            ],
            "ちゅうしょうきぎょう": [
                {
                    "kanji": "中小企業",
                    "hiragana": "ちゅうしょうきぎょう",
                    "priority": 1
                }
            ],
            "たいりく": [
                {
                    "kanji": "大陸",
                    "hiragana": "たいりく",
                    "priority": 1
                }
            ],
            "とうし": [
                {
                    "kanji": "投資",
                    "hiragana": "とうし",
                    "priority": 1
                }
            ],
            "ひょうげん": [
                {
                    "kanji": "表現",
                    "hiragana": "ひょうげん",
                    "priority": 1
                }
            ],
            "あどばいす": [
                {
                    "kanji": "アドバイス",
                    "hiragana": "あどばいす",
                    "priority": 1
                }
            ],
            "おんせい": [
                {
                    "kanji": "音声",
                    "hiragana": "おんせい",
                    "priority": 1
                }
            ],
            "ちょうせい": [
                {
                    "kanji": "調整",
                    "hiragana": "ちょうせい",
                    "priority": 1
                }
            ],
            "しゅるい": [
                {
                    "kanji": "種類",
                    "hiragana": "しゅるい",
                    "priority": 1
                }
            ],
            "せっと": [
                {
                    "kanji": "セット",
                    "hiragana": "せっと",
                    "priority": 1
                }
            ],
            "しょうひしゃ": [
                {
                    "kanji": "消費者",
                    "hiragana": "しょうひしゃ",
                    "priority": 1
                }
            ],
            "にゅうかいもうしこみ": [
                {
                    "kanji": "入会申込み",
                    "hiragana": "にゅうかいもうしこみ",
                    "priority": 1
                }
            ],
            "せんもんぎょうしゃ": [
                {
                    "kanji": "専門業者",
                    "hiragana": "せんもんぎょうしゃ",
                    "priority": 1
                }
            ],
            "こうじ": [
                {
                    "kanji": "工事",
                    "hiragana": "こうじ",
                    "priority": 1
                }
            ],
            "いご": [
                {
                    "kanji": "以後",
                    "hiragana": "いご",
                    "priority": 1
                }
            ],
            "つつしむ": [
                {
                    "kanji": "慎む",
                    "hiragana": "つつしむ",
                    "priority": 1
                }
            ],
            "ぜんいん": [
                {
                    "kanji": "全員",
                    "hiragana": "ぜんいん",
                    "priority": 1
                }
            ],
            "あいてがわ": [
                {
                    "kanji": "相手側",
                    "hiragana": "あいてがわ",
                    "priority": 1
                }
            ],
            "きょひせってい": [
                {
                    "kanji": "拒否設定",
                    "hiragana": "きょひせってい",
                    "priority": 1
                }
            ],
            "ひるね": [
                {
                    "kanji": "昼寝",
                    "hiragana": "ひるね",
                    "priority": 1
                }
            ],
            "もんだい": [
                {
                    "kanji": "問題",
                    "hiragana": "もんだい",
                    "priority": 1
                }
            ],
            "めに": [
                {
                    "kanji": "目",
                    "hiragana": "めに",
                    "priority": 1
                }
            ],
            "じょうし": [
                {
                    "kanji": "上司",
                    "hiragana": "じょうし",
                    "priority": 1
                }
            ],
            "ちからづよい": [
                {
                    "kanji": "力強い",
                    "hiragana": "ちからづよい",
                    "priority": 1
                }
            ],
            "めまい": [
                {
                    "kanji": "眩暈",
                    "hiragana": "めまい",
                    "priority": 1
                }
            ],
            "しんぱい": [
                {
                    "kanji": "心配",
                    "hiragana": "しんぱい",
                    "priority": 1
                }
            ],
            "はたらく": [
                {
                    "kanji": "働く",
                    "hiragana": "はたらく",
                    "priority": 1
                }
            ],
            "けっしん": [
                {
                    "kanji": "決心",
                    "hiragana": "けっしん",
                    "priority": 1
                }
            ],
            "うすぎり": [
                {
                    "kanji": "薄切り",
                    "hiragana": "うすぎり",
                    "priority": 1
                }
            ],
            "にがうりのちょうりほう": [
                {
                    "kanji": "苦瓜の調理法",
                    "hiragana": "にがうりのちょうりほう",
                    "priority": 1
                }
            ],
            "めのまえ": [
                {
                    "kanji": "目の前",
                    "hiragana": "めのまえ",
                    "priority": 1
                }
            ],
            "きたい": [
                {
                    "kanji": "期待",
                    "hiragana": "きたい",
                    "priority": 1
                }
            ],
            "さくら": [
                {
                    "kanji": "桜",
                    "hiragana": "さくら",
                    "priority": 1
                }
            ],
            "もちーふ": [
                {
                    "kanji": "モチーフ",
                    "hiragana": "もちーふ",
                    "priority": 1
                }
            ],
            "しょくじ": [
                {
                    "kanji": "食事",
                    "hiragana": "しょくじ",
                    "priority": 1
                }
            ],
            "はいべん": [
                {
                    "kanji": "排便",
                    "hiragana": "はいべん",
                    "priority": 1
                }
            ],
            "せわ": [
                {
                    "kanji": "世話",
                    "hiragana": "せわ",
                    "priority": 1
                }
            ],
            "だいえっと": [
                {
                    "kanji": "ダイエット",
                    "hiragana": "だいえっと",
                    "priority": 1
                }
            ],
            "げんそく": [
                {
                    "kanji": "原則",
                    "hiragana": "げんそく",
                    "priority": 1
                }
            ],
            "きぶんてんかん": [
                {
                    "kanji": "気分転換",
                    "hiragana": "きぶんてんかん",
                    "priority": 1
                }
            ],
            "さんぽ": [
                {
                    "kanji": "散歩",
                    "hiragana": "さんぽ",
                    "priority": 1
                }
            ],
            "りょうり": [
                {
                    "kanji": "料理",
                    "hiragana": "りょうり",
                    "priority": 1
                }
            ],
            "さいばんしょ": [
                {
                    "kanji": "裁判所",
                    "hiragana": "さいばんしょ",
                    "priority": 1
                }
            ],
            "ばいばいかかく": [
                {
                    "kanji": "売買価格",
                    "hiragana": "ばいばいかかく",
                    "priority": 1
                }
            ],
            "じぜんきょうぎ": [
                {
                    "kanji": "事前協議",
                    "hiragana": "じぜんきょうぎ",
                    "priority": 1
                }
            ],
            "しんせい": [
                {
                    "kanji": "申請",
                    "hiragana": "しんせい",
                    "priority": 1
                }
            ],
            "どうくつ": [
                {
                    "kanji": "洞窟",
                    "hiragana": "どうくつ",
                    "priority": 1
                }
            ],
            "いきま": [
                {
                    "kanji": "行きま",
                    "hiragana": "いきま",
                    "priority": 1
                }
            ],
            "さーば": [
                {
                    "kanji": "サーバ",
                    "hiragana": "さーば",
                    "priority": 1
                }
            ],
            "かぎばん": [
                {
                    "kanji": "鍵盤",
                    "hiragana": "かぎばん",
                    "priority": 1
                }
            ],
            "がくしゅう": [
                {
                    "kanji": "学習",
                    "hiragana": "がくしゅう",
                    "priority": 1
                }
            ],
            "いじょう": [
                {
                    "kanji": "以上",
                    "hiragana": "いじょう",
                    "priority": 1
                }
            ],
            "かいがいりょこう": [
                {
                    "kanji": "海外旅行",
                    "hiragana": "かいがいりょこう",
                    "priority": 1
                }
            ],
            "わからない": [
                {
                    "kanji": "分からない",
                    "hiragana": "わからない",
                    "priority": 1
                }
            ],
            "ぎじゅつしえん": [
                {
                    "kanji": "技術支援",
                    "hiragana": "ぎじゅつしえん",
                    "priority": 1
                }
            ],
            "けんか": [
                {
                    "kanji": "喧嘩",
                    "hiragana": "けんか",
                    "priority": 1
                }
            ],
            "ふたいてん": [
                {
                    "kanji": "不退転",
                    "hiragana": "ふたいてん",
                    "priority": 1
                }
            ],
            "けつい": [
                {
                    "kanji": "決意",
                    "hiragana": "けつい",
                    "priority": 1
                }
            ],
            "だれか": [
                {
                    "kanji": "誰か",
                    "hiragana": "だれか",
                    "priority": 1
                }
            ],
            "とく": [
                {
                    "kanji": "得",
                    "hiragana": "とく",
                    "priority": 1
                }
            ],
            "さんふじんか": [
                {
                    "kanji": "産婦人科",
                    "hiragana": "さんふじんか",
                    "priority": 1
                }
            ],
            "さがし": [
                {
                    "kanji": "探し",
                    "hiragana": "さがし",
                    "priority": 1
                }
            ],
            "めのあたり": [
                {
                    "kanji": "目の当たり",
                    "hiragana": "めのあたり",
                    "priority": 1
                }
            ],
            "いえ": [
                {
                    "kanji": "家",
                    "hiragana": "いえ",
                    "priority": 1
                }
            ],
            "けいさん": [
                {
                    "kanji": "計算",
                    "hiragana": "けいさん",
                    "priority": 1
                }
            ],
            "もくひょう": [
                {
                    "kanji": "目標",
                    "hiragana": "もくひょう",
                    "priority": 1
                }
            ],
            "ぼー": [
                {
                    "kanji": "ボー",
                    "hiragana": "ぼー",
                    "priority": 1
                }
            ],
            "ずるがしこい": [
                {
                    "kanji": "ずる賢い",
                    "hiragana": "ずるがしこい",
                    "priority": 1
                }
            ],
            "にんげん": [
                {
                    "kanji": "人間",
                    "hiragana": "にんげん",
                    "priority": 1
                }
            ],
            "ばか": [
                {
                    "kanji": "バカ",
                    "hiragana": "ばか",
                    "priority": 1
                }
            ],
            "ふり": [
                {
                    "kanji": "振り",
                    "hiragana": "ふり",
                    "priority": 1
                }
            ],
            "きょぎ": [
                {
                    "kanji": "虚偽",
                    "hiragana": "きょぎ",
                    "priority": 1
                }
            ],
            "こうげき": [
                {
                    "kanji": "攻撃",
                    "hiragana": "こうげき",
                    "priority": 1
                }
            ],
            "かりに": [
                {
                    "kanji": "仮に",
                    "hiragana": "かりに",
                    "priority": 1
                }
            ],
            "じんこう": [
                {
                    "kanji": "人口",
                    "hiragana": "じんこう",
                    "priority": 1
                }
            ],
            "ほけんがいしゃ": [
                {
                    "kanji": "保険会社",
                    "hiragana": "ほけんがいしゃ",
                    "priority": 1
                }
            ],
            "しりょうせいきゅう": [
                {
                    "kanji": "資料請求",
                    "hiragana": "しりょうせいきゅう",
                    "priority": 1
                }
            ],
            "せいねん": [
                {
                    "kanji": "青年",
                    "hiragana": "せいねん",
                    "priority": 1
                }
            ],
            "にもつ": [
                {
                    "kanji": "荷物",
                    "hiragana": "にもつ",
                    "priority": 1
                }
            ],
            "せいり": [
                {
                    "kanji": "整理",
                    "hiragana": "せいり",
                    "priority": 1
                }
            ],
            "かた": [
                {
                    "kanji": "肩",
                    "hiragana": "かた",
                    "priority": 1
                }
            ],
            "いき": [
                {
                    "kanji": "息",
                    "hiragana": "いき",
                    "priority": 1
                }
            ],
            "のうぜいしょうめいしょ": [
                {
                    "kanji": "納税証明書",
                    "hiragana": "のうぜいしょうめいしょ",
                    "priority": 1
                }
            ],
            "そうしんきかん": [
                {
                    "kanji": "送信期間",
                    "hiragana": "そうしんきかん",
                    "priority": 1
                }
            ],
            "あくしょん": [
                {
                    "kanji": "アクション",
                    "hiragana": "あくしょん",
                    "priority": 1
                }
            ],
            "くんれん": [
                {
                    "kanji": "訓練",
                    "hiragana": "くんれん",
                    "priority": 1
                }
            ],
            "さよく": [
                {
                    "kanji": "左翼",
                    "hiragana": "さよく",
                    "priority": 1
                }
            ],
            "はんたいせいは": [
                {
                    "kanji": "反体制派",
                    "hiragana": "はんたいせいは",
                    "priority": 1
                }
            ],
            "はなしあい": [
                {
                    "kanji": "話し合い",
                    "hiragana": "はなしあい",
                    "priority": 1
                }
            ],
            "とれーにんぐ": [
                {
                    "kanji": "トレーニング",
                    "hiragana": "とれーにんぐ",
                    "priority": 1
                }
            ],
            "かんぺき": [
                {
                    "kanji": "完璧",
                    "hiragana": "かんぺき",
                    "priority": 1
                }
            ],
            "おもって": [
                {
                    "kanji": "思って",
                    "hiragana": "おもって",
                    "priority": 1
                }
            ],
            "しっぱい": [
                {
                    "kanji": "失敗",
                    "hiragana": "しっぱい",
                    "priority": 1
                }
            ],
            "らっさつしゃ": [
                {
                    "kanji": "落札者",
                    "hiragana": "らっさつしゃ",
                    "priority": 1
                }
            ],
            "さーびすかいしゃ": [
                {
                    "kanji": "サービス会社",
                    "hiragana": "さーびすかいしゃ",
                    "priority": 1
                }
            ],
            "しょうひんとうちゃく": [
                {
                    "kanji": "商品到着",
                    "hiragana": "しょうひんとうちゃく",
                    "priority": 1
                }
            ],
            "れんらく": [
                {
                    "kanji": "連絡",
                    "hiragana": "れんらく",
                    "priority": 1
                }
            ],
            "じゅぎょう": [
                {
                    "kanji": "授業",
                    "hiragana": "じゅぎょう",
                    "priority": 1
                }
            ],
            "きたちょうせん": [
                {
                    "kanji": "北朝鮮",
                    "hiragana": "きたちょうせん",
                    "priority": 1
                }
            ],
            "せんそう": [
                {
                    "kanji": "戦争",
                    "hiragana": "せんそう",
                    "priority": 1
                }
            ],
            "わくわく": [
                {
                    "kanji": "わくわく",
                    "hiragana": "わくわく",
                    "priority": 1
                }
            ],
            "ひぞうてきしゅつ": [
                {
                    "kanji": "脾臓摘出",
                    "hiragana": "ひぞうてきしゅつ",
                    "priority": 1
                }
            ],
            "ねた": [
                {
                    "kanji": "ネタ",
                    "hiragana": "ねた",
                    "priority": 1
                }
            ],
            "ははおや": [
                {
                    "kanji": "母親",
                    "hiragana": "ははおや",
                    "priority": 1
                }
            ],
            "そうだん": [
                {
                    "kanji": "相談",
                    "hiragana": "そうだん",
                    "priority": 1
                }
            ],
            "かいし": [
                {
                    "kanji": "開始",
                    "hiragana": "かいし",
                    "priority": 1
                }
            ],
            "かくじちたい": [
                {
                    "kanji": "各自治体",
                    "hiragana": "かくじちたい",
                    "priority": 1
                }
            ],
            "とりくみ": [
                {
                    "kanji": "取り組み",
                    "hiragana": "とりくみ",
                    "priority": 1
                }
            ],
            "えんかくそうさ": [
                {
                    "kanji": "遠隔操作",
                    "hiragana": "えんかくそうさ",
                    "priority": 1
                }
            ],
            "しんぶん": [
                {
                    "kanji": "新聞",
                    "hiragana": "しんぶん",
                    "priority": 1
                }
            ],
            "きじ": [
                {
                    "kanji": "記事",
                    "hiragana": "きじ",
                    "priority": 1
                }
            ],
            "がくせい": [
                {
                    "kanji": "学生",
                    "hiragana": "がくせい",
                    "priority": 1
                }
            ],
            "あるばいと": [
                {
                    "kanji": "アルバイト",
                    "hiragana": "あるばいと",
                    "priority": 1
                }
            ],
            "りゆう": [
                {
                    "kanji": "理由",
                    "hiragana": "りゆう",
                    "priority": 1
                }
            ],
            "ちがい": [
                {
                    "kanji": "違い",
                    "hiragana": "ちがい",
                    "priority": 1
                }
            ],
            "かのうせい": [
                {
                    "kanji": "可能性",
                    "hiragana": "かのうせい",
                    "priority": 1
                }
            ],
            "ばあい": [
                {
                    "kanji": "場合",
                    "hiragana": "ばあい",
                    "priority": 1
                }
            ],
            "かんせん": [
                {
                    "kanji": "感染",
                    "hiragana": "かんせん",
                    "priority": 1
                }
            ],
            "きけんせい": [
                {
                    "kanji": "危険性",
                    "hiragana": "きけんせい",
                    "priority": 1
                }
            ],
            "こと": [
                {
                    "kanji": "事",
                    "hiragana": "こと",
                    "priority": 1
                }
            ],
            "きょうみ": [
                {
                    "kanji": "興味",
                    "hiragana": "きょうみ",
                    "priority": 1
                }
            ],
            "とくに": [
                {
                    "kanji": "特に",
                    "hiragana": "とくに",
                    "priority": 1
                }
            ],
            "げんかい": [
                {
                    "kanji": "限界",
                    "hiragana": "げんかい",
                    "priority": 1
                }
            ],
            "いみ": [
                {
                    "kanji": "意味",
                    "hiragana": "いみ",
                    "priority": 1
                }
            ],
            "なかま": [
                {
                    "kanji": "仲間",
                    "hiragana": "なかま",
                    "priority": 1
                }
            ],
            "わりあい": [
                {
                    "kanji": "割合",
                    "hiragana": "わりあい",
                    "priority": 1
                }
            ],
            "ほうほう": [
                {
                    "kanji": "方法",
                    "hiragana": "ほうほう",
                    "priority": 1
                }
            ],
            "はそん": [
                {
                    "kanji": "破損",
                    "hiragana": "はそん",
                    "priority": 1
                }
            ],
            "おそれ": [
                {
                    "kanji": "恐れ",
                    "hiragana": "おそれ",
                    "priority": 1
                }
            ],
            "ぜんぜん": [
                {
                    "kanji": "全然",
                    "hiragana": "ぜんぜん",
                    "priority": 1
                }
            ],
            "きおく": [
                {
                    "kanji": "記憶",
                    "hiragana": "きおく",
                    "priority": 1
                }
            ],
            "ふんいき": [
                {
                    "kanji": "雰囲気",
                    "hiragana": "ふんいき",
                    "priority": 1
                }
            ],
            "いわかん": [
                {
                    "kanji": "違和感",
                    "hiragana": "いわかん",
                    "priority": 1
                }
            ],
            "じかん": [
                {
                    "kanji": "時間",
                    "hiragana": "じかん",
                    "priority": 1
                }
            ],
            "ばしょ": [
                {
                    "kanji": "場所",
                    "hiragana": "ばしょ",
                    "priority": 1
                }
            ],
            "あんぜん": [
                {
                    "kanji": "安全",
                    "hiragana": "あんぜん",
                    "priority": 1
                }
            ],
            "いめーじ": [
                {
                    "kanji": "イメージ",
                    "hiragana": "いめーじ",
                    "priority": 1
                }
            ],
            "いんしょう": [
                {
                    "kanji": "印象",
                    "hiragana": "いんしょう",
                    "priority": 1
                }
            ],
            "すき": [
                {
                    "kanji": "好き",
                    "hiragana": "すき",
                    "priority": 1
                }
            ],
            "けいこう": [
                {
                    "kanji": "傾向",
                    "hiragana": "けいこう",
                    "priority": 1
                }
            ],
            "たいぷ": [
                {
                    "kanji": "タイプ",
                    "hiragana": "たいぷ",
                    "priority": 1
                }
            ],
            "じょせい": [
                {
                    "kanji": "女性",
                    "hiragana": "じょせい",
                    "priority": 1
                }
            ],
            "にんき": [
                {
                    "kanji": "人気",
                    "hiragana": "にんき",
                    "priority": 1
                }
            ],
            "くすり": [
                {
                    "kanji": "薬",
                    "hiragana": "くすり",
                    "priority": 1
                }
            ],
            "ふくさよう": [
                {
                    "kanji": "副作用",
                    "hiragana": "ふくさよう",
                    "priority": 1
                }
            ],
            "ちかく": [
                {
                    "kanji": "近く",
                    "hiragana": "ちかく",
                    "priority": 1
                }
            ],
            "たいへん": [
                {
                    "kanji": "大変",
                    "hiragana": "たいへん",
                    "priority": 1
                }
            ],
            "くろう": [
                {
                    "kanji": "苦労",
                    "hiragana": "くろう",
                    "priority": 1
                }
            ],
            "きかい": [
                {
                    "kanji": "機会",
                    "hiragana": "きかい",
                    "priority": 1
                }
            ],
            "いってい": [
                {
                    "kanji": "一定",
                    "hiragana": "いってい",
                    "priority": 1
                }
            ],
            "げんば": [
                {
                    "kanji": "現場",
                    "hiragana": "げんば",
                    "priority": 1
                }
            ],
            "けーす": [
                {
                    "kanji": "ケース",
                    "hiragana": "けーす",
                    "priority": 1
                }
            ],
            "てん": [
                {
                    "kanji": "点",
                    "hiragana": "てん",
                    "priority": 1
                }
            ],
            "さくせい": [
                {
                    "kanji": "作成",
                    "hiragana": "さくせい",
                    "priority": 1
                }
            ],
            "こすと": [
                {
                    "kanji": "コスト",
                    "hiragana": "こすと",
                    "priority": 1
                }
            ],
            "けんさく": [
                {
                    "kanji": "検索",
                    "hiragana": "けんさく",
                    "priority": 1
                }
            ],
            "もの": [
                {
                    "kanji": "物",
                    "hiragana": "もの",
                    "priority": 1
                },
                {
                    "kanji": "者",
                    "hiragana": "もの",
                    "priority": 1
                }
            ],
            "こうえん": [
                {
                    "kanji": "公園",
                    "hiragana": "こうえん",
                    "priority": 1
                }
            ],
            "ちから": [
                {
                    "kanji": "力",
                    "hiragana": "ちから",
                    "priority": 1
                }
            ],
            "かいはつ": [
                {
                    "kanji": "開発",
                    "hiragana": "かいはつ",
                    "priority": 1
                }
            ],
            "いけん": [
                {
                    "kanji": "意見",
                    "hiragana": "いけん",
                    "priority": 1
                }
            ],
            "みなさん": [
                {
                    "kanji": "皆さん",
                    "hiragana": "みなさん",
                    "priority": 1
                }
            ],
            "かぎり": [
                {
                    "kanji": "限り",
                    "hiragana": "かぎり",
                    "priority": 1
                }
            ],
            "はっきり": [
                {
                    "kanji": "言うつもり",
                    "hiragana": "はっきり",
                    "priority": 1
                }
            ],
            "やつら": [
                {
                    "kanji": "奴ら",
                    "hiragana": "やつら",
                    "priority": 1
                }
            ],
            "なにを": [
                {
                    "kanji": "文句",
                    "hiragana": "なにを",
                    "priority": 1
                }
            ],
            "だんかい": [
                {
                    "kanji": "段階",
                    "hiragana": "だんかい",
                    "priority": 1
                }
            ],
            "かんしゃ": [
                {
                    "kanji": "感謝",
                    "hiragana": "かんしゃ",
                    "priority": 1
                }
            ],
            "ちゅうと": [
                {
                    "kanji": "中途",
                    "hiragana": "ちゅうと",
                    "priority": 1
                }
            ],
            "みまん": [
                {
                    "kanji": "未満",
                    "hiragana": "みまん",
                    "priority": 1
                }
            ],
            "おれい": [
                {
                    "kanji": "お礼",
                    "hiragana": "おれい",
                    "priority": 1
                }
            ],
            "もんく": [
                {
                    "kanji": "文句",
                    "hiragana": "もんく",
                    "priority": 1
                }
            ],
            "おなじ": [
                {
                    "kanji": "同じ",
                    "hiragana": "おなじ",
                    "priority": 1
                }
            ],
            "こうもく": [
                {
                    "kanji": "項目",
                    "hiragana": "こうもく",
                    "priority": 1
                }
            ],
            "せっていち": [
                {
                    "kanji": "設定値",
                    "hiragana": "せっていち",
                    "priority": 1
                }
            ],
            "じょうたい": [
                {
                    "kanji": "状態",
                    "hiragana": "じょうたい",
                    "priority": 1
                }
            ],
            "おこなった": [
                {
                    "kanji": "行った",
                    "hiragana": "おこなった",
                    "priority": 1
                }
            ],
            "ていき": [
                {
                    "kanji": "定期",
                    "hiragana": "ていき",
                    "priority": 1
                }
            ],
            "いか": [
                {
                    "kanji": "以下",
                    "hiragana": "いか",
                    "priority": 1
                }
            ],
            "にちじょうせいかつ": [
                {
                    "kanji": "日常生活",
                    "hiragana": "にちじょうせいかつ",
                    "priority": 1
                }
            ],
            "えんじょ": [
                {
                    "kanji": "援助",
                    "hiragana": "えんじょ",
                    "priority": 1
                }
            ],
            "かいぜん": [
                {
                    "kanji": "改善",
                    "hiragana": "かいぜん",
                    "priority": 1
                }
            ],
            "たいとる": [
                {
                    "kanji": "タイトル",
                    "hiragana": "たいとる",
                    "priority": 1
                }
            ],
            "ふん": [
                {
                    "kanji": "分",
                    "hiragana": "ふん",
                    "priority": 1
                }
            ],
            "はっぴょう": [
                {
                    "kanji": "発表",
                    "hiragana": "はっぴょう",
                    "priority": 1
                }
            ],
            "てーま": [
                {
                    "kanji": "テーマ",
                    "hiragana": "てーま",
                    "priority": 1
                }
            ],
            "けんとう": [
                {
                    "kanji": "検討",
                    "hiragana": "けんとう",
                    "priority": 1
                }
            ],
            "はっしん": [
                {
                    "kanji": "発信",
                    "hiragana": "はっしん",
                    "priority": 1
                }
            ],
            "ずいじ": [
                {
                    "kanji": "随時",
                    "hiragana": "ずいじ",
                    "priority": 1
                }
            ],
            "にってい": [
                {
                    "kanji": "日程",
                    "hiragana": "にってい",
                    "priority": 1
                }
            ],
            "ぐあい": [
                {
                    "kanji": "具合",
                    "hiragana": "ぐあい",
                    "priority": 1
                }
            ],
            "しゅうせい": [
                {
                    "kanji": "修正",
                    "hiragana": "しゅうせい",
                    "priority": 1
                }
            ],
            "まえ": [
                {
                    "kanji": "前",
                    "hiragana": "まえ",
                    "priority": 1
                }
            ],
            "きょうぎ": [
                {
                    "kanji": "協議",
                    "hiragana": "きょうぎ",
                    "priority": 1
                }
            ],
            "しすてむ": [
                {
                    "kanji": "システム",
                    "hiragana": "しすてむ",
                    "priority": 1
                }
            ],
            "せっけい": [
                {
                    "kanji": "設計",
                    "hiragana": "せっけい",
                    "priority": 1
                }
            ],
            "きぎょう": [
                {
                    "kanji": "企業",
                    "hiragana": "きぎょう",
                    "priority": 1
                }
            ],
            "でーた": [
                {
                    "kanji": "データ",
                    "hiragana": "でーた",
                    "priority": 1
                }
            ],
            "にんてい": [
                {
                    "kanji": "認定",
                    "hiragana": "にんてい",
                    "priority": 1
                }
            ],
            "ちゅうもん": [
                {
                    "kanji": "注文",
                    "hiragana": "ちゅうもん",
                    "priority": 1
                }
            ],
            "かならず": [
                {
                    "kanji": "必ず",
                    "hiragana": "かならず",
                    "priority": 1
                }
            ],
            "まいあさ": [
                {
                    "kanji": "毎朝",
                    "hiragana": "まいあさ",
                    "priority": 1
                }
            ],
            "けんこう": [
                {
                    "kanji": "健康",
                    "hiragana": "けんこう",
                    "priority": 1
                }
            ],
            "せんぱい": [
                {
                    "kanji": "先輩",
                    "hiragana": "せんぱい",
                    "priority": 1
                }
            ],
            "こもじ": [
                {
                    "kanji": "小文字",
                    "hiragana": "こもじ",
                    "priority": 1
                }
            ],
            "おやすみ": [
                {
                    "kanji": "おやすみ",
                    "hiragana": "おやすみ",
                    "priority": 1
                }
            ],
            "なさい": [
                {
                    "kanji": "なさい",
                    "hiragana": "なさい",
                    "priority": 1
                }
            ],
            "おげんき": [
                {
                    "kanji": "お元気",
                    "hiragana": "おげんき",
                    "priority": 1
                }
            ],
            "げんき": [
                {
                    "kanji": "元気",
                    "hiragana": "げんき",
                    "priority": 1
                }
            ],
            "おかげさま": [
                {
                    "kanji": "お陰様",
                    "hiragana": "おかげさま",
                    "priority": 1
                }
            ],
            "ひさしぶり": [
                {
                    "kanji": "久しぶり",
                    "hiragana": "ひさしぶり",
                    "priority": 1
                }
            ],
            "もうしわけ": [
                {
                    "kanji": "申し訳",
                    "hiragana": "もうしわけ",
                    "priority": 1
                }
            ],
            "いいえ": [
                {
                    "kanji": "いいえ",
                    "hiragana": "いいえ",
                    "priority": 1
                }
            ],
            "だいじょうぶ": [
                {
                    "kanji": "大丈夫",
                    "hiragana": "だいじょうぶ",
                    "priority": 1
                }
            ],
            "きにしないで": [
                {
                    "kanji": "気にしないで",
                    "hiragana": "きにしないで",
                    "priority": 1
                }
            ],
            "ください": [
                {
                    "kanji": "下さい",
                    "hiragana": "ください",
                    "priority": 1
                }
            ],
            "なぜ": [
                {
                    "kanji": "何故",
                    "hiragana": "なぜ",
                    "priority": 1
                }
            ],
            "いくら": [
                {
                    "kanji": "いくら",
                    "hiragana": "いくら",
                    "priority": 1
                }
            ],
            "なんじ": [
                {
                    "kanji": "何時",
                    "hiragana": "なんじ",
                    "priority": 1
                }
            ],
            "どうして": [
                {
                    "kanji": "どうして",
                    "hiragana": "どうして",
                    "priority": 1
                }
            ],
            "しって": [
                {
                    "kanji": "知って",
                    "hiragana": "しって",
                    "priority": 1
                }
            ],
            "なるほど": [
                {
                    "kanji": "成程",
                    "hiragana": "なるほど",
                    "priority": 1
                }
            ],
            "てつだって": [
                {
                    "kanji": "手伝って",
                    "hiragana": "てつだって",
                    "priority": 1
                }
            ],
            "おいしい": [
                {
                    "kanji": "おいしい",
                    "hiragana": "おいしい",
                    "priority": 1
                }
            ],
            "おなか": [
                {
                    "kanji": "お腹",
                    "hiragana": "おなか",
                    "priority": 1
                }
            ],
            "すきました": [
                {
                    "kanji": "空きました",
                    "hiragana": "すきました",
                    "priority": 1
                }
            ],
            "きをつけて": [
                {
                    "kanji": "気を付けて",
                    "hiragana": "きをつけて",
                    "priority": 1
                }
            ],
            "きらい": [
                {
                    "kanji": "きらい",
                    "hiragana": "きらい",
                    "priority": 1
                }
            ],
            "べんり": [
                {
                    "kanji": "便利",
                    "hiragana": "べんり",
                    "priority": 1
                }
            ],
            "ふべん": [
                {
                    "kanji": "不便",
                    "hiragana": "ふべん",
                    "priority": 1
                }
            ],
            "つまらない": [
                {
                    "kanji": "つまらない",
                    "hiragana": "つまらない",
                    "priority": 1
                }
            ],
            "むずかしい": [
                {
                    "kanji": "難しい",
                    "hiragana": "むずかしい",
                    "priority": 1
                }
            ],
            "かなしい": [
                {
                    "kanji": "悲しい",
                    "hiragana": "かなしい",
                    "priority": 1
                }
            ],
            "はずかしい": [
                {
                    "kanji": "恥ずかしい",
                    "hiragana": "はずかしい",
                    "priority": 1
                }
            ],
            "おこって": [
                {
                    "kanji": "怒って",
                    "hiragana": "おこって",
                    "priority": 1
                }
            ],
            "こまって": [
                {
                    "kanji": "困って",
                    "hiragana": "こまって",
                    "priority": 1
                }
            ],
            "もういちど": [
                {
                    "kanji": "もう一度",
                    "hiragana": "もういちど",
                    "priority": 1
                }
            ],
            "おねがい": [
                {
                    "kanji": "お願い",
                    "hiragana": "おねがい",
                    "priority": 1
                }
            ],
            "すてき": [
                {
                    "kanji": "素敵",
                    "hiragana": "すてき",
                    "priority": 1
                }
            ],
            "れすとらん": [
                {
                    "kanji": "レストラン",
                    "hiragana": "れすとらん",
                    "priority": 1
                }
            ],
            "ぱすた": [
                {
                    "kanji": "パスタ",
                    "hiragana": "ぱすた",
                    "priority": 1
                }
            ],
            "ぜっこう": [
                {
                    "kanji": "絶好",
                    "hiragana": "ぜっこう",
                    "priority": 1
                }
            ],
            "しゅうまつ": [
                {
                    "kanji": "週末",
                    "hiragana": "しゅうまつ",
                    "priority": 1
                }
            ],
            "ぴくにっく": [
                {
                    "kanji": "ピクニック",
                    "hiragana": "ぴくにっく",
                    "priority": 1
                }
            ],
            "たのしみ": [
                {
                    "kanji": "楽しみ",
                    "hiragana": "たのしみ",
                    "priority": 1
                }
            ],
            "だいすき": [
                {
                    "kanji": "大好き",
                    "hiragana": "だいすき",
                    "priority": 1
                }
            ],
            "せかいじゅう": [
                {
                    "kanji": "世界中",
                    "hiragana": "せかいじゅう",
                    "priority": 1
                }
            ],
            "かかる": [
                {
                    "kanji": "掛かる",
                    "hiragana": "かかる",
                    "priority": 1
                }
            ],
            "よみごたえ": [
                {
                    "kanji": "読み応え",
                    "hiragana": "よみごたえ",
                    "priority": 1
                }
            ],
            "たいせつ": [
                {
                    "kanji": "大切",
                    "hiragana": "たいせつ",
                    "priority": 1
                }
            ]
        }
    }



    // 辞書データをトライ木に読み込む
    private loadDictionaryToTrie() {
        for (const hiragana in this.dictionary) {
            const entries = this.dictionary[hiragana];
            if (entries) {
                this.insertToTrie(hiragana, entries);
            }
        }
    }



    // トライ木に単語を挿入する
    private insertToTrie(hiragana: string, entries: WordEntry[]) {
        let node = this.trieRoot;
        for (const char of hiragana) {
            if (!node.children[char]) {
                node.children[char] = { children: {} };
            }
            node = node.children[char];
        }
        node.entry = entries; // 複数エントリを格納
    }


    // トライ木から最長一致検索
    private searchLongestMatch(hiragana: string): { entry: WordEntry[] | null; matchedLength: number } {
        let node = this.trieRoot;
        let longestMatchLength = 0;
        let matchedEntry: WordEntry[] | null = null;

        for (let i = 0; i < hiragana.length; i++) {
            const char = hiragana[i];
            if (node.children[char]) {
                node = node.children[char];
                if (node.entry) {
                    longestMatchLength = i + 1;
                    matchedEntry = node.entry;
                }
            } else {
                break;
            }
        }
        return { entry: matchedEntry, matchedLength: longestMatchLength };
    }


    // 学習機能（インメモリ辞書に追加）
    public extendDictionaryFromTrainingData(trainingData: { hiragana: string; kanji: string }[]) {
        for (const data of trainingData) {
            const hiragana = data.hiragana;
            const kanji = data.kanji;

            const newEntry: WordEntry = {
                kanji: kanji,
                hiragana: hiragana,
                priority: 1
            };

            const { entry: existingEntries, matchedLength } = this.searchLongestMatch(hiragana);

            if (existingEntries && matchedLength === hiragana.length) {
                const isKanjiExists = existingEntries.some(e => e.kanji === kanji);
                if (!isKanjiExists) {
                    existingEntries.push(newEntry);
                    this.insertToTrie(hiragana, existingEntries); // Trieも更新
                    this.dictionary[hiragana] = existingEntries; // インメモリ辞書を更新
                }
            } else {
                this.insertToTrie(hiragana, [newEntry]);  // Trieも更新
                this.dictionary[hiragana] = [newEntry];   // インメモリ辞書を更新
            }
        }
    }



    public async convert(romajiText: string): Promise<string> {
        let hiraganaText = this.convertToHiragana(romajiText);

        let result = "";
        let remainingText = hiraganaText;

        while (remainingText.length > 0) {
            const { entry, matchedLength } = this.searchLongestMatch(remainingText);

            if (matchedLength > 0 && entry) {
                // 優先度が最も高いエントリを選択（複数候補がある場合）
                const bestEntry = entry.reduce((prev, current) => (prev.priority > current.priority) ? prev : current);

                result += bestEntry.kanji;
                remainingText = remainingText.substring(matchedLength);
            } else {
                result += remainingText[0];
                remainingText = remainingText.substring(1);
            }
        }
        return result.trim();
    }

    private convertToHiragana(romajiText: string): string {
        let hiraganaText = "";
        let i = 0;
        while (i < romajiText.length) {
            let found = false;

            for (let len = 5; len > 0; len--) {
                if (i + len <= romajiText.length) {
                    const chunk = romajiText.substring(i, i + len);
                    if (this.romajiToHiragana[chunk]) {
                        hiraganaText += this.romajiToHiragana[chunk];
                        i += len;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {

                hiraganaText += romajiText[i];
                i++;
            }
        }
        return hiraganaText;
    }
}

/**
 * 
 * 
async function test() {

    const converter = await RomajiKanjiConverter.create();

    console.log(await converter.convert("konnnichiha"));      // こんにちは
    console.log(await converter.convert("watashi"));          // 私
    console.log(await converter.convert("arigatou"));         // ありがとう
    console.log(await converter.convert("atarashii"));         // 新しい
    console.log(await converter.convert("nihon"));           // 日本
    console.log(await converter.convert("kyouhaitenki"));       // 今日は天気
    console.log(await converter.convert("810"));              // 野獣
    console.log(await converter.convert("dousajiltukenn simasu kyounotennkihadoudesukane?")); // 動作実験 します 今日の天気はどうですかね?

    // 学習機能のテスト
    converter.extendDictionaryFromTrainingData([
        { hiragana: "てすと", kanji: "テスト" }
    ]);

    console.log(await converter.convert("tesuto")); // テスト


}

test();
 */