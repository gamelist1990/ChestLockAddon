import { Player, world } from "@minecraft/server";
import { c } from "../Modules/Util";
import { registerCommand, verifier,prefix } from "../Modules/Handler";

// === 辞書データ ===
interface DictionaryEntry {
  hiragana: string;
  kanji: string;
}

const dictionaryData: DictionaryEntry[] = [
  { hiragana: "にほん", kanji: "日本" },
  { hiragana: "なんで", kanji: "何で" },
  { hiragana: "しら", kanji: "知ら" },
  { hiragana: "いみ", kanji: "意味" },
  { hiragana: "あさ", kanji: "朝" },
  { hiragana: "はな", kanji: "花" },
  { hiragana: "たいせつ", kanji: "大切" },
  { hiragana: "ともだち", kanji: "友達" },
  { hiragana: "べんきょう", kanji: "勉強" },
  { hiragana: "ごはん", kanji: "ご飯" },
  { hiragana: "しごと", kanji: "仕事" },
  { hiragana: "でんわ", kanji: "電話" },
  { hiragana: "みず", kanji: "水" },
  { hiragana: "にち", kanji: "日" },
  { hiragana: "つき", kanji: "月" },
  { hiragana: "ほし", kanji: "星" },
  { hiragana: "じかん", kanji: "時間" },
  { hiragana: "せんせい", kanji: "先生" },
  { hiragana: "がっこう", kanji: "学校" },
  { hiragana: "くうき", kanji: "空気" },
  { hiragana: "たいよう", kanji: "太陽" },
  { hiragana: "ほしぞら", kanji: "星空" },
  { hiragana: "あめ", kanji: "雨" },
  { hiragana: "ゆき", kanji: "雪" },
  { hiragana: "かぜ", kanji: "風" },
  { hiragana: "うみ", kanji: "海" },
  { hiragana: "やま", kanji: "山" },
  { hiragana: "どうぶつ", kanji: "動物" },
  { hiragana: "とり", kanji: "鳥" },
  { hiragana: "さかな", kanji: "魚" },
  { hiragana: "いぬ", kanji: "犬" },
  { hiragana: "ねこ", kanji: "猫" },
  { hiragana: "くるま", kanji: "車" },
  { hiragana: "いえ", kanji: "家" },
  { hiragana: "ひと", kanji: "人" },
  { hiragana: "おとこ", kanji: "男" },
  { hiragana: "おんな", kanji: "女" },
  { hiragana: "こども", kanji: "子供" },
  { hiragana: "あたらしい", kanji: "新しい" },
  { hiragana: "おもしろい", kanji: "面白い" },
  { hiragana: "げんき", kanji: "元気" },
  { hiragana: "つかれた", kanji: "疲れた" },
  { hiragana: "おいしい", kanji: "美味しい" },
  { hiragana: "きたない", kanji: "汚い" },
  { hiragana: "きれい", kanji: "綺麗" },
  { hiragana: "つよい", kanji: "強い" },
  { hiragana: "よわい", kanji: "弱い" },
  { hiragana: "おおきい", kanji: "大きい" },
  { hiragana: "ちいさい", kanji: "小さい" },
  { hiragana: "あつい", kanji: "暑い" }, 
  { hiragana: "つめたい", kanji: "冷たい" },
  { hiragana: "あかるい", kanji: "明るい" },
  { hiragana: "くらいい", kanji: "暗い" },
  { hiragana: "ふるい", kanji: "古い" },
  { hiragana: "たのしい", kanji: "楽しい" },
  { hiragana: "かなしい", kanji: "悲しい" },
  { hiragana: "びょうき", kanji: "病気" },
  { hiragana: "たいへん", kanji: "大変" },
  { hiragana: "かんたん", kanji: "簡単" },
  { hiragana: "じょうず", kanji: "上手" },
  { hiragana: "へた", kanji: "下手" },
  { hiragana: "はやい", kanji: "早い" },
  { hiragana: "おそい", kanji: "遅い" },
  { hiragana: "まっすぐ", kanji: "真っ直ぐ" },
  { hiragana: "まがった", kanji: "曲がった" },
  { hiragana: "さむい", kanji: "寒い" },
  { hiragana: "よごれ", kanji: "汚れ" },
  { hiragana: "かわいい", kanji: "可愛い" },
  { hiragana: "やさしい", kanji: "優しい" },
  { hiragana: "きびしい", kanji: "厳しい" },
  { hiragana: "しずか", kanji: "静か" },
  { hiragana: "うるさい", kanji: "うるさい" },
  { hiragana: "まずい", kanji: "まずい" },
  { hiragana: "あまい", kanji: "甘い" },
  { hiragana: "すっぱい", kanji: "酸っぱい" },
  { hiragana: "からい", kanji: "辛い" },
  { hiragana: "にがい", kanji: "苦い" },
  { hiragana: "あたたかい", kanji: "温かい" },
  { hiragana: "おおい", kanji: "多い" },
  { hiragana: "すくない", kanji: "少ない" },
  { hiragana: "むずかしい", kanji: "難しい" }
];

const dictionary: { [key: string]: string[] } = {};
dictionaryData.forEach(({ hiragana, kanji }) => {
  if (!dictionary[kanji]) {
    dictionary[kanji] = [];
  }
  dictionary[kanji].push(hiragana);
});

// === ローマ字変換テーブル ===
const conversionTable: { [key: string]: string[] } = {
  // Basic Hiragana
  "a": ["あ", "ア", "a"],
  "i": ["い", "イ", "i"],
  "u": ["う", "ウ", "u"],
  "e": ["え", "エ", "e"],
  "o": ["お", "オ", "o"],
  "ka": ["か", "カ", "ka"],
  "ki": ["き", "キ", "ki"],
  "ku": ["く", "ク", "ku"],
  "ke": ["け", "ケ", "ke"],
  "ko": ["こ", "コ", "ko"],
  "sa": ["さ", "サ", "sa"],
  "si": ["し", "シ", "si"],
  "su": ["す", "ス", "su"],
  "se": ["せ", "セ", "se"],
  "so": ["そ", "ソ", "so"],
  "ta": ["た", "タ", "ta"],
  "ti": ["ち", "チ", "ti"],
  "tu": ["つ", "ツ", "tu"],
  "te": ["て", "テ", "te"],
  "to": ["と", "ト", "to"],
  "na": ["な", "ナ", "na"],
  "ni": ["に", "ニ", "ni"],
  "nu": ["ぬ", "ヌ", "nu"],
  "ne": ["ね", "ネ", "ne"],
  "no": ["の", "ノ", "no"],
  "ha": ["は", "ハ", "ha"],
  "hi": ["ひ", "ヒ", "hi"],
  "fu": ["ふ", "フ", "fu"],
  "he": ["へ", "ヘ", "he"],
  "ho": ["ほ", "ホ", "ho"],
  "ma": ["ま", "マ", "ma"],
  "mi": ["み", "ミ", "mi"],
  "mu": ["む", "ム", "mu"],
  "me": ["め", "メ", "me"],
  "mo": ["も", "モ", "mo"],
  "ya": ["や", "ヤ", "ya"],
  "yu": ["ゆ", "ユ", "yu"],
  "yo": ["よ", "ヨ", "yo"],
  "ra": ["ら", "ラ", "ra"],
  "ri": ["り", "リ", "ri"],
  "ru": ["る", "ル", "ru"],
  "re": ["れ", "レ", "re"],
  "ro": ["ろ", "ロ", "ro"],
  "wa": ["わ", "ワ", "wa"],
  "wo": ["を", "ヲ", "wo"],
  "nn": ["ん", "ン", "nn"],

  // "G" sounds
  "ga": ["が", "ガ", "ga"],
  "gi": ["ぎ", "ギ", "gi"],
  "gu": ["ぐ", "グ", "gu"],
  "ge": ["げ", "ゲ", "ge"],
  "go": ["ご", "ゴ", "go"],

  // "Z" sounds
  "za": ["ざ", "ザ", "za"],
  "ji": ["じ", "ジ", "ji"],
  "zu": ["ず", "ズ", "zu"],
  "ze": ["ぜ", "ゼ", "ze"],
  "zo": ["ぞ", "ゾ", "zo"],

  // "D" sounds
  "da": ["だ", "ダ", "da"],
  "di": ["ぢ", "ヂ", "di"],
  "du": ["づ", "ヅ", "du"],
  "de": ["で", "デ", "de"],
  "do": ["ど", "ド", "do"],

  // "B" sounds
  "ba": ["ば", "バ", "ba"],
  "bi": ["び", "ビ", "bi"],
  "bu": ["ぶ", "ブ", "bu"],
  "be": ["べ", "ベ", "be"],
  "bo": ["ぼ", "ボ", "bo"],

  // "P" sounds
  "pa": ["ぱ", "パ", "pa"],
  "pi": ["ぴ", "ピ", "pi"],
  "pu": ["ぷ", "プ", "pu"],
  "pe": ["ぺ", "ペ", "pe"],
  "po": ["ぽ", "ポ", "po"],

  // "K" sounds with "ya", "yu", "yo"
  "kya": ["きゃ", "キャ", "kya"],
  "kyu": ["きゅ", "キュ", "kyu"],
  "kyo": ["きょ", "キョ", "kyo"],

  // "S" sounds with "ya", "yu", "yo"
  "sha": ["しゃ", "シャ", "sha"],
  "shu": ["しゅ", "シュ", "shu"],
  "sho": ["しょ", "ショ", "sho"],

  // "Ch" sounds with "ya", "yu", "yo"
  "cha": ["ちゃ", "チャ", "cha"],
  "chu": ["ちゅ", "チュ", "chu"],
  "cho": ["ちょ", "チョ", "cho"],

  // "N" sounds with "ya", "yu", "yo"
  "nya": ["にゃ", "ニャ", "nya"],
  "nyu": ["にゅ", "ニュ", "nyu"],
  "nyo": ["にょ", "ニョ", "nyo"],

  // "H" sounds with "ya", "yu", "yo"
  "hya": ["ひゃ", "ヒャ", "hya"],
  "hyu": ["ひゅ", "ヒュ", "hyu"],
  "hyo": ["ひょ", "ヒョ", "hyo"],

  // "M" sounds with "ya", "yu", "yo"
  "mya": ["みゃ", "ミャ", "mya"],
  "myu": ["みゅ", "ミュ", "myu"],
  "myo": ["みょ", "ミョ", "myo"],

  // "R" sounds with "ya", "yu", "yo"
  "rya": ["りゃ", "リャ", "rya"],
  "ryu": ["りゅ", "リュ", "ryu"],
  "ryo": ["りょ", "リョ", "ryo"],

  // "G" sounds with "ya", "yu", "yo"
  "gya": ["ぎゃ", "ギャ", "gya"],
  "gyu": ["ぎゅ", "ギュ", "gyu"],
  "gyo": ["ぎょ", "ギョ", "gyo"],

  // "J" sounds with "ya", "yu", "yo"
  "ja": ["じゃ", "ジャ", "ja"],
  "ju": ["じゅ", "ジュ", "ju"],
  "jo": ["じょ", "ジョ", "jo"],

  // "B" sounds with "ya", "yu", "yo"
  "bya": ["びゃ", "ビャ", "bya"],
  "byu": ["びゅ", "ビュ", "byu"],
  "byo": ["びょ", "ビョ", "byo"],

  // "P" sounds with "ya", "yu", "yo"
  "pya": ["ぴゃ", "ピャ", "pya"],
  "pyu": ["ぴゅ", "ピュ", "pyu"],
  "pyo": ["ぴょ", "ピョ", "pyo"],

  // Double Consonant Sounds (before 'k' sounds)
  "kka": ["っか", "ッカ"],
  "kki": ["っき", "ッキ"],
  "kku": ["っく", "ック"],
  "kke": ["っけ", "ッケ"],
  "kko": ["っこ", "ッコ"],


  // Custom

  "fi": ["フィ", "フィ", "fi"],  
  "xi": ["ぃ", "イ", "xi"], 
  "ltu": ["っ", "イ", "ltu"],
  "xtu": ["っ", "イ", "xtu"], 


  // Long Sound Mark
  "ー": ["ー", "ー", "-"],
};


// === ローマ字からひらがなへの変換 ===
function romajiToHiragana(romaji: string): string {
    let result = "";
    let i = 0;
    while (i < romaji.length) {
      // 3文字から始まる変換を探す
      if (i < romaji.length - 2 && conversionTable[romaji.substring(i, i + 3)]) {
        result += conversionTable[romaji.substring(i, i + 3)][0];
        i += 3;
      } else if (i < romaji.length - 1 && conversionTable[romaji.substring(i, i + 2)]) {
        // 2文字から始まる変換を探す
        result += conversionTable[romaji.substring(i, i + 2)][0];
        i += 2;
      } else if (conversionTable[romaji[i]]) {
        // 1文字の変換を探す
        result += conversionTable[romaji[i]][0];
        i++;
      } else {
        // 変換テーブルにない場合はそのまま追加
        result += romaji[i];
        i++;
      }
    }
    return result;
  }

// === 最長一致検索による単語分割 ===
function splitIntoWords(text: string): string[] {
  const words: string[] = [];
  let currentWord = "";
  for (let i = 0; i < text.length; i++) {
    currentWord += text[i];
    let longestMatch = "";
    for (const word in dictionary) {
      if (
        currentWord === word &&
        word.length > longestMatch.length
      ) {
        longestMatch = word;
      }
    }
    if (longestMatch) {
      words.push(longestMatch);
      currentWord = "";
    }
  }
  if (currentWord) {
    words.push(currentWord);
  }
  return words;
}

// === ローマ字変換関数 (再構築版) ===
function convertRomajiToJapanese(romaji: string): string {
  if (romaji.startsWith(`${prefix}`)) {
    return romaji; // prefixで始まる文字は除外
  }
  const hiraganaText = romajiToHiragana(romaji);
  const words = splitIntoWords(hiraganaText);
  let result = "";
  for (const word of words) {
    if (dictionary[word]) {
      result += dictionary[word][0]; // 最初の候補を採用
    } else {
      result += word; // 辞書にない場合はそのまま
    }
  }
  return result;
}

let romajiConversionEnabled = false;
const playerConversionStatus = new Map<Player, boolean>();

//@ts-ignore
world.beforeEvents.chatSend.subscribe((event: any) => {
  const player = event.sender;
  if (!(player instanceof Player)) return;

  const isEnabled = playerConversionStatus.get(player) ?? romajiConversionEnabled;

  if (isEnabled) {
    const originalMessage = event.message;
    const convertedMessage = convertRomajiToJapanese(originalMessage);

    event.cancel = true;
    world.sendMessage(`<${player.name}> ${originalMessage} §6(${convertedMessage})`);
  }
});

registerCommand({
  name: "test",
  description: "test_command_description",
  parent: false,
  maxArgs: 1,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands["test"]),
  executor: (player: Player, args: string[]) => {
    const input = args[0];

    if (input === "-true") {
      playerConversionStatus.set(player, true);
      player.sendMessage("§aローマ字変換が有効になりました。");
    } else if (input === "-false") {
      playerConversionStatus.set(player, false);
      player.sendMessage("§cローマ字変換が無効になりました。");
    } else {
      player.sendMessage("§c無効な引数です。 '-true' または '-false' を指定してください。");
    }
  },
});             