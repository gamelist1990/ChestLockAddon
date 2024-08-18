import { promises as fs } from 'fs';
import path from 'path';

const srcFolder = 'devFolder/src/command/langs/list';
const enUSFileName = 'en_US.json';
const targetLanguages = ['ja_JP','fi_FI','ko_KR','ru_RU','zh_CN'];

const enUSJsonPath = path.join(srcFolder, enUSFileName);

async function mergeJsonFiles() {
  try {
    // en_US.jsonを読み込む
    const enUSJsonData = await fs.readFile(enUSJsonPath, 'utf8');
    const enUSJson = JSON.parse(enUSJsonData);

    for (const targetLanguage of targetLanguages) {
      const targetJsonPath = path.join(srcFolder, `${targetLanguage}.json`);

      let targetJson = {};
      if (await fs.access(targetJsonPath).then(() => true).catch(() => false)) {
        // ターゲットJSONファイルが存在する場合、その内容を読み込む
        const targetJsonData = await fs.readFile(targetJsonPath, 'utf8');
        targetJson = JSON.parse(targetJsonData);
      }

      // マージされたJSONオブジェクトを作成する
      const mergedJson = {};

      for (const key of Object.keys(enUSJson)) {
        mergedJson[key] = {
          msgid: enUSJson[key].msgid,
          msgstr: targetJson[key]?.msgstr || ''
        };
      }

      // マージされたJSONオブジェクトをファイルに書き込む
      await fs.writeFile(targetJsonPath, JSON.stringify(mergedJson, null, 2), 'utf8');

      console.log(`Translation keys and msgids copied and synchronized successfully for: ${targetJsonPath}`);
    }
  } catch (error) {
    console.error('Error merging JSON files:', error);
  }
}

mergeJsonFiles();
