import JsonDB from "./DataBase"; //JsonDBの実装に依存しないように修正を施してください。

interface WordEntry {
    kanji: string;
    hiragana: string;
    priority: number;
}

// Trie Node のインターフェース
interface TrieNode {
    children: { [key: string]: TrieNode };
    entry?: WordEntry[]; // このノードで終わる単語のエントリ (複数対応)
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
        ssa: "っさ", ssi: "っし", ssu: "っす", sse: "っせ", sso: "っそ", ssha: "っしゃ", ssho:"っしょ",
        tta: "った", tti: "っち", ttsu: "っつ", tte: "って", tto: "っと",
        ppa: "っぱ", ppi: "っぴ", ppu: "っぷ", ppe: "っぺ", ppo: "っぽ",
    };

    private db: JsonDB;
    private devMode: boolean;
    private trieRoot: TrieNode; // トライ木のルートノード

    // static なファクトリーメソッドを作成
    static async create(devMode: boolean = false): Promise<RomajiKanjiConverter> {
        const converter = new RomajiKanjiConverter(devMode);
        await converter.initialize(); // 初期化処理をここで行う
        return converter;
    }

    // private な初期化メソッド（コンストラクタから分離）
    private async initialize() {
        await this.initializeDictionary(); // これで await できる
        if (this.devMode) {
            this.setupConsoleListener();
        }
    }

    //コンストラクタはprivate
    private constructor(devMode: boolean = false) {
        this.db = new JsonDB("dictionary");
        this.devMode = devMode;
        this.trieRoot = { children: {} }; // 初期化
    }


    private async initializeDictionary() {
        const hasData = await this.db.has("defaultDictionaryLoaded");

        if (!hasData) {
            await this.loadDefaultDictionary();
            await this.db.set("defaultDictionaryLoaded", true);
        }
        await this.loadDictionaryToTrie(); // 既存の辞書、初期辞書をまとめて読み込む

    }

    // 辞書データをトライ木に読み込む
    private async loadDictionaryToTrie() {
        const allEntries = await this.db.getAll();
        for (const hiragana in allEntries) {
            const entries = allEntries[hiragana];
            if (entries) {
                this.insertToTrie(hiragana, entries);
            }
        }
    }


    private async loadDefaultDictionary() {
        const defaultDictionary: { [key: string]: WordEntry[] } = {
            "こんにちは": [{ kanji: "こんにちは", hiragana: "こんにちは", priority: 5 }],
            "わたし": [{ kanji: "私", hiragana: "わたし", priority: 3 }],
            "あなた": [{ kanji: "あなた", hiragana: "あなた", priority: 3 }],
            "かれ": [{ kanji: "彼", hiragana: "かれ", priority: 3 }],
            "かのじょ": [{ kanji: "彼女", hiragana: "かのじょ", priority: 3 }],
            "いぬ": [{ kanji: "犬", hiragana: "いぬ", priority: 3 }],
            "ねこ": [{ kanji: "猫", hiragana: "ねこ", priority: 3 }],
            "たべる": [{ kanji: "食べる", hiragana: "たべる", priority: 3 }],
            "のむ": [{ kanji: "飲む", hiragana: "のむ", priority: 3 }],
            "みる": [{ kanji: "見る", hiragana: "みる", priority: 3 }],
            "きく": [{ kanji: "聞く", hiragana: "きく", priority: 3 }],
            "いく": [{ kanji: "行く", hiragana: "いく", priority: 3 }],
            "くる": [{ kanji: "来る", hiragana: "くる", priority: 3 }],
            "かわいい": [{ kanji: "可愛い", hiragana: "かわいい", priority: 3 }],
            "うれしい": [{ kanji: "嬉しい", hiragana: "うれしい", priority: 3 }],
            "たのしい": [{ kanji: "楽しい", hiragana: "たのしい", priority: 3 }],
            "おもしろい": [{ kanji: "面白い", hiragana: "おもしろい", priority: 3 }],
            "ねむい": [{ kanji: "眠い", hiragana: "ねむい", priority: 3 }],
            "おはよう": [{ kanji: "おはよう", hiragana: "おはよう", priority: 5 }],
            "こんばんは": [{ kanji: "こんばんは", hiragana: "こんばんは", priority: 5 }],
            "さようなら": [{ kanji: "さようなら", hiragana: "さようなら", priority: 5 }],
            "ありがとう": [{ kanji: "ありがとう", hiragana: "ありがとう", priority: 5 }],
            "すみません": [{ kanji: "すみません", hiragana: "すみません", priority: 5 }],
            "あたらしい": [{ kanji: "新しい", hiragana: "あたらしい", priority: 5 }],
            "たんご": [{ kanji: "単語", hiragana: "たんご", priority: 3 }],
            "に": [{ kanji: "に", hiragana: "に", priority: 3 }],
            "する": [{ kanji: "する", hiragana: "する", priority: 3 }],
            "あした": [{ kanji: "明日", hiragana: "あした", priority: 3 }],
            "きょう": [{ kanji: "今日", hiragana: "きょう", priority: 3 }],
            "にほん": [{ kanji: "日本", hiragana: "にほん", priority: 5 }],
            "にほんご": [{ kanji: "日本語", hiragana: "にほんご", priority: 5 }],
            "にほんじん": [{ kanji: "日本人", hiragana: "にほんじん", priority: 5 }],
            "いみふめい": [{ kanji: "意味不明", hiragana: "いみふめい", priority: 5 }],
            "なんで": [{ kanji: "何で", hiragana: "なんで", priority: 5 }],
            "いみわからん": [{ kanji: "意味わからん", hiragana: "いみわからん", priority: 5 }],
            "にほんごとしておかしい": [{ kanji: "日本語としておかしい", hiragana: "にほんごとしておかしい", priority: 5 }],
            "まじか": [{ kanji: "マジか", hiragana: "まじか", priority: 5 }],
            "てんき": [{ kanji: "天気", hiragana: "てんき", priority: 3 }],
        };

        // JSON DB への書き込みとトライ木への登録を分離
        for (const hiragana in defaultDictionary) {
            await this.db.set(hiragana, defaultDictionary[hiragana]);
        }
        await this.loadDictionaryToTrie(); // DBへの書き込み後、トライ木に一括登録
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


    public async extendDictionaryFromTrainingData(trainingData: { hiragana: string; kanji: string }[]) {
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
                    this.insertToTrie(hiragana, existingEntries);
                    await this.db.set(hiragana, existingEntries);
                    console.log(`辞書に新しい漢字 '${kanji}' を追加しました。(ひらがな: ${hiragana})`);
                } else {
                    console.log(`漢字 '${kanji}' は既に ${hiragana} のエントリとして登録されています。`);
                }
            }
            else {

                this.insertToTrie(hiragana, [newEntry]);
                await this.db.set(hiragana, [newEntry]);
                console.log(`辞書に新しい単語 '${kanji}' (ひらがな: ${hiragana}) を登録しました。`);
            }

        }
    }



    public async convert(romajiText: string): Promise<string> {
        let hiraganaText = this.convertToHiragana(romajiText);

        // devMode に関係なく、以下の通常の変換ロジックを使用
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


    private setupConsoleListener() {

        process.stdin.setEncoding('utf8');

        process.stdin.on('data', async (data: string) => {
            let command = data.trim().replace(/　/g, " ");

            if (command.startsWith('!test ')) {
                const inputText = command.substring(6).trim();
                console.log("変換結果:", await this.convert(inputText));
            }
            else if (command.startsWith('!learn ')) {
                const learnText = command.substring(7).trim();
                const parts = learnText.split(" ");

                if (parts.length % 2 === 0 && parts.length > 0) {
                    let trainingData: { hiragana: string; kanji: string }[] = [];
                    for (let i = 0; i < parts.length; i += 2) {
                        trainingData.push({ hiragana: parts[i].trim(), kanji: parts[i + 1].trim() });
                    }

                    await this.extendDictionaryFromTrainingData(trainingData);
                    console.log("学習完了!");
                } else {
                    console.log("不正な入力です。!learn ひらがな 漢字 ひらがな 漢字 ...のように入力してください。");
                }
            }
        });
        console.log("コンソール監視を開始しました。'!test ローマ字' で変換を '!learn ひらがな 漢字'で学習できます。");
    }

}


/**
 * async function test() {
    const devMode = process.argv.includes('--dev'); // コマンドライン引数で dev モードを制御

    const converter = await RomajiKanjiConverter.create(devMode);
    if (!devMode) { //devModeでなければ実行
        console.log(await converter.convert("konnnichiha"));
        console.log(await converter.convert("watashi"));
        console.log(await converter.convert("arigatou"));
        console.log(await converter.convert("atarashii"));
        console.log(await converter.convert("nihon"));
        console.log(await converter.convert("kyouhaitenki"));
        console.log(await converter.convert("dousajiltukenn simasu kyounotennkihadoudesukane?"));
    }

}
test();
 */