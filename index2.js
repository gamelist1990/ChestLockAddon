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
        const msgid = JSON.stringify(jsonContent[key].msgid);
        const msgstr = JSON.stringify(jsonContent[key].msgstr);
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
