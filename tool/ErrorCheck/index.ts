import { checkJsFile, checkZipFile } from './errorChecker';
import fs from 'fs/promises';
import path from 'path';
import express, { Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const app = express();

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const originalname = file.originalname;
        const ext = path.extname(originalname);
        const baseName = path.basename(originalname, ext);
        const filename = `${baseName}-${uuidv4().substring(0, 3)}${ext}`;
        cb(null, filename);
    },
});

const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

const checkRouteHandler: RequestHandler = (req: MulterRequest, res: Response) => {
    return new Promise<void>((resolve, reject) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded.' });
                resolve();
                return;
            }

            let fileCheckPromise: Promise<{ filePath: string; line: number; character: number; message: string; basename: string; }[]>;

            if (req.file.originalname.endsWith('.zip')) {
                fileCheckPromise = checkZipFile(req.file.path);
            } else if (req.file.originalname.endsWith('.js') || req.file.originalname.endsWith('.ts')) {
                fileCheckPromise = checkJsFile(req.file.path).then(errors =>
                    errors.map(error => ({ ...error, basename: path.basename(error.filePath) }))
                );
            } else {
                res.status(400).json({ error: '対応していないファイル形式です。zipかjsまたはtsファイルをアップロードしてください。' });
                resolve();
                return;
            }

            fileCheckPromise
                .then(errors => {
                    res.json({ errors });
                    resolve();
                })
                .catch(reject)
                .finally(() => { if (req.file) fs.unlink(req.file.path).catch(console.error) });

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