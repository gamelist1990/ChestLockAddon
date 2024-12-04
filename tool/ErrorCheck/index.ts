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

const checkRouteHandler: RequestHandler = async (req: MulterRequest, res: Response) => {
    console.log('Request received:', 'Method',req.method,'Path', req.path);

    try {
        if (!req.file) {
            console.log('No file uploaded.');
            res.status(400).json({ error: 'No file uploaded.' });
            return;
        }

        let fileCheckPromise: Promise<{ filePath: string; line: number; character: number; message: string; basename: string; }[]>;

        const fileExt = path.extname(req.file.originalname).toLowerCase();

        if (fileExt === '.zip') {
            fileCheckPromise = checkZipFile(req.file.path);
        } else if (fileExt === '.js' || fileExt === '.ts') {
            fileCheckPromise = checkJsFile(req.file.path).then(errors =>
                errors.map(error => ({ ...error, basename: path.basename(error.filePath) }))
            );
        } else {
            console.log('Unsupported file type:', fileExt);
            res.status(400).json({ error: '対応していないファイル形式です。zipかjsまたはtsファイルをアップロードしてください。' });
            return;
        }

        const errors = await fileCheckPromise;

        res.json({ errors });

    } catch (error: any) {
        console.error('An error occurred:', error);
        res.status(500).json({ error: 'An error occurred on the server.', details: error.message });
    } finally {
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
                console.log('File deleted:', req.file.path);
            } catch (unlinkError: any) {
                console.error('Error deleting file:', unlinkError);
            }
        }
    }
};


app.post('/check', upload.single('file'), checkRouteHandler);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});

const port = 3000;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});