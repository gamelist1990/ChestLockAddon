import { promises as fs } from 'fs';
import path from 'path';

const srcFolder = 'devFolder/src/command/langs/list';
const targetLanguages = ['en_US', 'ja_JP', 'fi_FI', 'ko_KR', 'ru_RU', 'zh_CN'];

async function convertJsonToTs() {
  try {
    for (const language of targetLanguages) {
      const jsonFilePath = path.join(srcFolder, `${language}.json`);
      const tsFilePath = path.join(srcFolder, `${language}.ts`);

      const jsonData = await fs.readFile(jsonFilePath, 'utf8');
      const jsonContent = JSON.parse(jsonData);

      let tsContent = 'export const translations = {\n';
      for (const key in jsonContent) {
        // `msgid` の処理
        let msgid = '';
        if (Array.isArray(jsonContent[key].msgid)) { // 配列の場合
          msgid = jsonContent[key].msgid.join('\n'); // 各行を `\n` で連結
        } else { // 単一文字列の場合
          msgid = jsonContent[key].msgid;
        }
        msgid = JSON.stringify(msgid);

        // `msgstr` の処理
        let msgstr = '';
        if (typeof jsonContent[key].msgstr === 'string') { // 文字列の場合
          msgstr = JSON.stringify(jsonContent[key].msgstr);
        } else if (Array.isArray(jsonContent[key].msgstr)) { // 配列の場合
          msgstr = jsonContent[key].msgstr.join('\n'); // 各行を `\n` で連結
          msgstr = JSON.stringify(msgstr);
        }

        tsContent += `  "${key}": {\n    msgid: ${msgid},\n    msgstr: ${msgstr}\n  },\n`;
      }
      tsContent += '};\n';

      await fs.writeFile(tsFilePath, tsContent, 'utf8');

      console.log(`Converted ${jsonFilePath} to ${tsFilePath}`);
    }
  } catch (error) {
    console.error('Error converting JSON to TypeScript:', error);
  }
}

convertJsonToTs();