import { EntityIsHiddenWhenInvisibleComponent } from './../../node_modules/@minecraft/server-ui/node_modules/@minecraft/server/index.d';
import typescript from 'typescript';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';

//既存のcheckJsFileのコード
export async function checkJsFile(filePath: string): Promise<{ filePath: string; line: number; character: number; message: string; }[]> {
    try {
        let compilerOptions: typescript.CompilerOptions;
        const configFileName = typescript.findConfigFile('./', typescript.sys.fileExists);
        if (configFileName) {
            const configFile = typescript.readConfigFile(configFileName, typescript.sys.readFile);
            if (configFile.error) {
                throw new Error(`Error reading tsconfig.json: ${JSON.stringify(configFile.error)}`);
            }
            compilerOptions = typescript.parseJsonConfigFileContent(
                configFile.config,
                typescript.sys,
                './',
                undefined,
                configFileName
            ).options;
        } else {
            console.warn('tsconfig.json not found, using default options.(この場合はMinecraftのデータのモジュールが使用できません)');
            compilerOptions = {
                "target": typescript.ScriptTarget.ESNext,
                "module": typescript.ModuleKind.ESNext,
                "strict": true,
                "noEmit": true,
                "allowJs": true,
                "checkJs": true
            };
            // or throw new Error('tsconfig.json not found.');
        }

        const program = typescript.createProgram([filePath], compilerOptions);
        const diagnostics = program.getSemanticDiagnostics();

        //診断が0個の場合構文エラーをチェックする
        if (diagnostics.length === 0) {
            const syntacticDiagnostics = program.getSyntacticDiagnostics(program.getSourceFile(filePath)!);
            if (syntacticDiagnostics.length > 0) {
                const syntaxErrors = syntacticDiagnostics.map(diagnostic => {
                    const { line, character } = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start!);
                    const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    return {
                        filePath,
                        line: line + 1,
                        character: character + 1,
                        message,
                    };
                });
                return syntaxErrors;
            }
        }

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
        console.error('Error checking file:', error);
        return [{ filePath, line: 0, character: 0, message: `Error checking file: ${error.message}` }];
    }
}





export async function checkJsFilesInDirectory(dirPath: string): Promise<{ filePath: string; line: number; character: number; message: string; basename: string; }[]> {
    let allErrors: { filePath: string; line: number; character: number; message: string; basename: string; }[] = [];

    try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            if (file.endsWith('.js') || file.endsWith('.ts')) {
                const filePath = path.join(dirPath, file);
                const errors = await checkJsFile(filePath);
                const errorsWithBasename = errors.map(error => ({
                    ...error,
                    basename: path.basename(error.filePath)
                }));
                allErrors = allErrors.concat(errorsWithBasename);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath} :`, error);
        allErrors.push({ filePath: dirPath, line: 0, character: 0, message: `Error reading directory: ${error.message}`, basename: path.basename(dirPath) });

    }

    return allErrors;
}


export async function checkZipFile(zipFilePath: string): Promise<{ filePath: string; line: number; character: number; message: string; basename: string; }[]> {
    try {
        const zip = new (AdmZip as any)(zipFilePath);
        const zipEntries = zip.getEntries();

        let allErrors: { filePath: string; line: number; character: number; message: string; basename: string; }[] = [];

        const tempFolderPath = `./uploads/temp-${Date.now()}`;
        await fs.mkdir(tempFolderPath);

        for (const zipEntry of zipEntries) {
            zip.extractEntryTo(zipEntry, tempFolderPath, true, true);
        }


        const walk = async (dir: string): Promise<void> => {
            const files = await fs.readdir(dir);

            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = await fs.stat(filePath);

                if (stat.isDirectory()) {
                    await walk(filePath); // サブディレクトリを再帰的に処理
                } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.ts'))) {
                    const errors = await checkJsFile(filePath);

                    const errorsWithBasename = errors.map(error => ({
                        ...error,
                        basename: path.basename(error.filePath)
                    }));
                    allErrors = allErrors.concat(errorsWithBasename);

                }
            }
        };


        await walk(tempFolderPath);
        await fs.rm(tempFolderPath, { recursive: true, force: true });

        return allErrors;

    } catch (error) {
        console.error('Error checking zip file:', error);
        return [{ filePath: '', line: 0, character: 0, message: `Error checking zip file: ${error.message}`, basename: '' }];
    }
}