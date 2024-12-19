// 全角を半角に変換する関数（変更なし）
const toHalfWidth = (str: string) => {
    return str
        .replace(/[！-～]/g, (char: string) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char: string) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/[\u3000]/g, " ");
};

// 正規化関数を修正（変更なし）
const normalize = (message: any) => {
    return toHalfWidth(message)
        .toLowerCase()
        .replace(/[ \-\~\@\!\?\/\(\)\[\]\{\}\<\>\,\:\;\+\=\`\~\$\%\^\&\*\|\#._]+/g, '');
};

// 不適切語リスト
const badWords = [
    "3p",
    "av女優",
    "gスポット",
    "ntr",
    "fuck",
    "fck",
    "badd",
    "bad",
    "くそ",
    "ばか",
];

// スコア設定
const scoreConfig = {
    "3p": 10,
    "av女優": 8,
    "gスポット": 8,
    "ntr": 10,
    "fuck": 10,
    "fck": 8,
    "badd": 5,
    "bad": 5,
    "くそ": 7,
    "ばか": 7,
}

// スコアリングシステムの設定
const ruleScores = {
    exactMatch: 2,  // 完全一致のスコア
    fuzzyMatch: 1.5, // あいまい一致のスコア
    similarMatch: 1  // 類似一致のスコア
};

// スコアリング関数
const calculateScore = (normalizedText: string, badWords: string[], scoreConfig: { [key: string]: number }, ruleScores: { exactMatch: number, fuzzyMatch: number, similarMatch: number }): number => {
    let totalScore = 0;
    const matchedWords = new Set<string>();

    for (const word of badWords) {
        // 完全一致
        const exactMatchRegex = new RegExp(`(?:^|\\s)${word}(?:$|\\s)`, "g"); // 単語境界 \b を使用して完全一致をチェック, gフラグ追加
        const exactMatches = normalizedText.matchAll(exactMatchRegex);
        for (const match of exactMatches) {
            totalScore += (scoreConfig[word] || 0) * ruleScores.exactMatch;
            matchedWords.add(match[0].trim()); // マッチした単語を保存
        }
        // あいまい一致（部分一致）
        if (!matchedWords.has(word)) {
            const fuzzyMatchRegex = new RegExp(`${word}`, "g"); // gフラグ追加
            const fuzzyMatches = normalizedText.matchAll(fuzzyMatchRegex);
            for (const _match of fuzzyMatches) {
                totalScore += (scoreConfig[word] || 0) * ruleScores.fuzzyMatch;
            }
        }

    }
    return totalScore;
};

// スコアのしきい値
const scoreThreshold = 10;

// スコアリング結果を判定する関数
const isMessageInappropriate = (message: string): boolean => {
    const normalizedMessage = normalize(message);
    const score = calculateScore(normalizedMessage, badWords, scoreConfig, ruleScores);
    return score >= scoreThreshold;
};

// テストケースの修正
const testCases = [
    // 英語の基本的なケース
    { input: "fuck", expectedNormalized: "fuck", expectedScore: 20, description: "英語の基本単語" }, // 完全一致
    { input: "FUCK", expectedNormalized: "fuck", expectedScore: 20, description: "大文字の英語単語" },
    { input: "f*ck", expectedNormalized: "fck", expectedScore: 16, description: "アスタリスクを含む英語単語" }, //あいまい一致

    // 日本語の基本的なケース
    { input: "ばか", expectedNormalized: "ばか", expectedScore: 14, description: "日本語の基本単語" },  // 完全一致
    { input: "バカ", expectedNormalized: "バカ", expectedScore: 0, description: "カタカナの日本語単語" },
    { input: "くそ", expectedNormalized: "くそ", expectedScore: 14, description: "別の日本語単語" }, // 完全一致

    // 記号とスペースのケース
    { input: "f-u-c-k", expectedNormalized: "fuck", expectedScore: 20, description: "ハイフンを含む単語" },
    { input: "f_u_c_k", expectedNormalized: "fuck", expectedScore: 20, description: "アンダーバーを含む単語" },
    { input: "f.u.c.k", expectedNormalized: "fuck", expectedScore: 20, description: "ドットを含む単語" },
    { input: "b a d", expectedNormalized: "bad", expectedScore: 10, description: "スペースで区切られた単語" },

    // 複数の不適切語のケース
    { input: "bad bad", expectedNormalized: "badbad", expectedScore: 15, description: "連続した不適切語" }, //あいまい一致
    { input: "badd", expectedNormalized: "badd", expectedScore: 17.5, description: "連続した不適切語" }, //あいまい一致
    { input: "bad,bad", expectedNormalized: "badbad", expectedScore: 15, description: "カンマで区切られた不適切語" }, //あいまい一致
    { input: "b@d b@d", expectedNormalized: "bdbd", expectedScore: 0, description: "記号で区切られた不適切語" }, //あいまい一致

    // 全角と半角のケース
    { input: "ｆｕｃｋ", expectedNormalized: "fuck", expectedScore: 20, description: "全角英字" }, // 完全一致
    { input: "１２３", expectedNormalized: "123", expectedScore: 0, description: "全角数字" },

    // 類似単語のケース
    { input: "f*ck", expectedNormalized: "fck", expectedScore: 12, description: "類似英語単語 (アスタリスク)" }, //あいまい一致
    { input: "fck", expectedNormalized: "fck", expectedScore: 16, description: "類似英語単語 (c の欠落)" }, //完全一致
    { input: "ば*か", expectedNormalized: "ばか", expectedScore: 12, description: "類似日本語単語 (アスタリスク)" }, //あいまい一致
    { input: "ばか", expectedNormalized: "ばか", expectedScore: 14, description: "類似日本語単語 (か の欠落)" }, //完全一致

    // その他のケース
    { input: "abc123", expectedNormalized: "abc123", expectedScore: 0, description: "英数字の組み合わせ" },
    { input: " ", expectedNormalized: "", expectedScore: 0, description: "空白のみ" },
    { input: "", expectedNormalized: "", expectedScore: 0, description: "空文字列" },
    { input: "a", expectedNormalized: "a", expectedScore: 0, description: "1文字の単語" },
    { input: "very_very_long_word_with_many_characters", expectedNormalized: "veryverylongwordwithmanycharacters", expectedScore: 0, description: "非常に長い単語" },
    { input: "fuck you", expectedNormalized: "fuckyou", expectedScore: 15, description: "不適切語を含む文章" }, //あいまい一致
    { input: "bad day", expectedNormalized: "badday", expectedScore: 7.5, description: "不適切語を含む文章" },  //あいまい一致
    { input: "くそー", expectedNormalized: "くそー", expectedScore: 10.5, description: "不適切語を含む文章" }, //あいまい一致
    { input: "ばかだな", expectedNormalized: "ばかだな", expectedScore: 10.5, description: "不適切語を含む文章" }, //あいまい一致
    { input: "3p", expectedNormalized: "3p", expectedScore: 20, description: "3p" }, // 完全一致
    { input: "AV女優", expectedNormalized: "av女優", expectedScore: 16, description: "av女優" }, // 完全一致
    { input: "Gスポット", expectedNormalized: "gスポット", expectedScore: 16, description: "Gスポット" }, // 完全一致
    { input: "NTR", expectedNormalized: "ntr", expectedScore: 20, description: "NTR" }, // 完全一致
    { input: "this is a fuck", expectedNormalized: "thisisafuck", expectedScore: 15, description: "文章のなかのfuck" }, //あいまい一致

];

// テストを実行する関数
function runTests(tests: any[]) {
    let passed = 0;
    let failed = 0;

    tests.forEach((test: { input: any; expectedNormalized: any; expectedScore: number, description: any; }) => {
        const actualNormalized = normalize(test.input);
        const actualScore = calculateScore(actualNormalized, badWords, scoreConfig, ruleScores);
        if (actualNormalized === test.expectedNormalized && actualScore === test.expectedScore) {
            console.log(`✅ ${test.description} (スコア: ${actualScore})`);
            passed++;
        } else {
            console.error(`❌ ${test.description}: 期待値 (正規化: "${test.expectedNormalized}", スコア: ${test.expectedScore}), 実際の結果 (正規化: "${actualNormalized}", スコア: ${actualScore})  入力: "${test.input}"`);
            failed++;
        }

        // 不適切と判定されるかどうかのテスト
        const isInappropriate = isMessageInappropriate(test.input);
        if (actualScore >= scoreThreshold && !isInappropriate) {
            console.error(`❌ 不適切判定テスト失敗: 期待値: 判定あり 実際: 判定なし 入力: ${test.input} スコア: ${actualScore}`)
            failed++;
        }

        if (actualScore < scoreThreshold && isInappropriate) {
            console.error(`❌ 不適切判定テスト失敗: 期待値: 判定なし 実際: 判定あり 入力: ${test.input} スコア: ${actualScore}`)
            failed++;
        }

    });

    console.log(`\nテスト完了: ${passed} 件成功, ${failed} 件失敗`);
}

runTests(testCases);