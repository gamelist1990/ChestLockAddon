import typescript from 'typescript';
import fs from 'fs/promises';

export async function checkJsFile(filePath: string): Promise<{ filePath: string; line: number; character: number; message: string; }[]> {
    try {
        const configFileName = typescript.findConfigFile('./', typescript.sys.fileExists); 
        const configFile = typescript.readConfigFile(configFileName!, typescript.sys.readFile);

        const compilerOptions = typescript.parseJsonConfigFileContent(
            configFile.config,
            typescript.sys,
            './', 
            undefined,
            configFileName
        ).options;

        compilerOptions.noEmit = true; 

        const program = typescript.createProgram([filePath], compilerOptions);


        // 型チェックとエラーの取得
        const diagnostics = program.getSemanticDiagnostics();


        const errors = diagnostics.map(diagnostic => {
            const { line, character } = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start!);
            const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            return {
                filePath,
                line: line + 1,
                character: character + 1,
                message,
            };
        });

        return errors;


    } catch (error) {
        console.error('Error reading file:', error);
        return [{ filePath, line: 0, character: 0, message: 'Error reading file' }];
    }
}