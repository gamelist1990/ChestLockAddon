import { checkJsFile } from './errorChecker';
import fs from 'fs/promises';
import path from 'path';
import express, { Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Multerの設定 (オリジナルのファイル名を使用し、UUIDで重複を回避)
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const originalname = file.originalname;
        const ext = path.extname(originalname);
        const baseName = path.basename(originalname, ext);
        const filename = `${baseName}-${uuidv4().substring(0,3)}${ext}`;
        cb(null, filename);
    },
});

const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

const checkRouteHandler: RequestHandler = async (req: MulterRequest, res: Response) => {
    return new Promise<void>(async (resolve, reject) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded.' });
                resolve();
                return;
            }

            console.log("Original filename:", req.file.originalname);
            console.log("Saved filename:", req.file.filename);
            console.log("File path:", req.file.path);

            const errors = await checkJsFile(req.file.path);

            // basenameを追加
            const errorsWithBasename = errors.map(error => ({
                ...error,
                basename: path.basename(error.filePath)
            }));


            await fs.unlink(req.file.path);


            res.json({ errors: errorsWithBasename }); // errorsWithBasename を送信


            resolve();

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'An error occurred on the server.' });
            reject(error);
        }
    });
};

app.post('/check', upload.single('file'), checkRouteHandler);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});