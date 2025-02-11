import { promises as fs } from 'fs';
import * as path from 'path';

interface Data {
    [key: string]: any;
}

class JsonDB {
    private filePath: string;
    private dbDir: string;

    constructor(dbName: string, dbDirectory: string = './database') {  // dbDirectory defaults to './database'
        this.dbDir = path.resolve(dbDirectory);  // Ensure absolute path
        this.filePath = path.join(this.dbDir, `${dbName}.json`);
    }

    private async ensureDirectoryExists(): Promise<void> {
        try {
            await fs.mkdir(this.dbDir, { recursive: true }); // Creates the directory if it doesn't exist (recursive: true handles nested paths)
        } catch (error: any) {
            if (error.code !== 'EEXIST') { // Ignore if directory already exists
                throw error;
            }
        }
    }


    private async readData(): Promise<Data> {
        await this.ensureDirectoryExists(); // Ensure directory exists before reading
        try {
            const data = await fs.readFile(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    }

    private async writeData(data: Data): Promise<void> {
        await this.ensureDirectoryExists(); // Ensure directory exists before writing
        await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async getAll(): Promise<Data> {
        return await this.readData();
    }

    async get(key: string): Promise<any | undefined> {
        const data = await this.readData();
        return data[key];
    }

    async set(key: string, value: any): Promise<void> {
        const data = await this.readData();
        data[key] = value;
        await this.writeData(data);
    }

    async delete(key: string): Promise<boolean> {
        const data = await this.readData();
        if (data.hasOwnProperty(key)) {
            delete data[key];
            await this.writeData(data);
            return true;
        }
        return false;
    }

    async has(key: string): Promise<boolean> {
        const data = await this.readData();
        return data.hasOwnProperty(key);
    }

    async clear(): Promise<void> {
        await this.writeData({});
    }
}

export default JsonDB;