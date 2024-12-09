import express from 'express';
import { Request, Response } from 'express';
import * as fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

// 静的ファイルを提供する設定
app.use(express.static('public'));

interface ItemData {
    id: number;
    name: string;
    quantity: number;
    price: number;
    currency: string;
}

interface ShopData {
    owner: string;
    password: string;
    items: ItemData[];
    imageUrl?: string;
}

interface ShopUserData {
    [shopName: string]: {
        password: string;
    };
}

const shopUserDBPath = './ShopUser.json';

async function loadShopUserData(): Promise<ShopUserData> {
    try {
        const data = await fs.readFile(shopUserDBPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
            return {};
        }
        console.error("ShopUser.jsonの読み込みエラー:", error);
        throw error;
    }
}

async function saveShopUserData(data: ShopUserData): Promise<void> {
    try {
        await fs.writeFile(shopUserDBPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error("ShopUser.jsonの書き込みエラー:", error);
        throw error;
    }
}

// テストデータ (サンプル)
const testShopNames = ["Player1", "Player2", "Player3"];

// ShopUser.json と shopData にテストデータを追加
async function initializeTestData() {
    try {
        await loadShopUserData();
        testShopNames.forEach(shopName => {
            if (!shopUserData[shopName]) {
                const password = generateRandomPassword();
                shopUserData[shopName] = { password };
                shopData[shopName] = {
                    owner: shopName,
                    password,
                    items: [
                        { id: nextItemId++, name: "ダイヤモンド", quantity: 64, price: 10, currency: "ダイヤモンド" },
                        { id: nextItemId++, name: "鉄インゴット", quantity: 32, price: 2, currency: "鉄インゴット" },
                    ],
                    imageUrl: `https://via.placeholder.com/150?text=${shopName}`,
                };
            }
        });
        await saveShopUserData(shopUserData);
    } catch (error) {
        console.error("テストデータ初期化エラー:", error);
    }
}

function generateRandomPassword(length = 10): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

let shopUserData: ShopUserData = {};
loadShopUserData().then(data => {
    shopUserData = data;
}).catch(error => {
    console.error("サーバー起動時のデータベース読み込みエラー:", error);
    process.exit(1);
});

// サーバー起動時にテストデータを初期化
initializeTestData().then(() => {
    console.log("テストデータ初期化完了");
}).catch(console.error);

const shopData: Record<string, ShopData> = {};
let nextItemId = 1;

const authenticate = async (req: Request, res: Response, next: any) => {
    const shopName = req.params.shopName;
    const { password } = req.body;

    try {
        await loadShopUserData();
        if (shopUserData[shopName]?.password === password) {
            next();
        } else {
            res.status(401).json({ error: '認証失敗' });
        }
    } catch (error) {
        res.status(500).json({ error: '認証処理中にエラーが発生しました' });
    }
};

app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/shops', (req: Request, res: Response) => {
    const shops = Object.keys(shopUserData).map(shopName => {
        const shop = shopData[shopName];
        return {
            name: shopName,
            imageUrl: shop?.imageUrl
        };
    });
    res.json(shops);
});

app.post('/api/shop/create', async (req: any, res: any) => {
    const { shopName, owner, password, imageUrl } = req.body;

    if (!shopName || !owner || !password) {
        return res.status(400).json({ error: '必要なパラメータが不足しています' });
    }

    try {
        await loadShopUserData();
        if (shopUserData[shopName]) {
            return res.status(409).json({ error: 'ショップ名が既に使用されています' });
        }

        shopUserData[shopName] = { password };
        await saveShopUserData(shopUserData);

        shopData[shopName] = { owner, password, items: [], imageUrl };
        console.log("ショップ作成:", shopName, owner, password, imageUrl);
        res.status(201).json({ message: 'ショップを作成しました' });

    } catch (error) {
        console.error("ショップ作成エラー:", error);
        res.status(500).json({ error: 'ショップの作成に失敗しました。' });
    }
});

app.use('/api/shop/:shopName/*', authenticate);

app.post('/api/shop/:shopName/login', (req: Request, res: Response) => {
    res.json({ message: 'ログイン成功' });
});

app.get('/api/shop/:shopName/items', (req: Request, res: Response) => {
    const shopName = req.params.shopName;
    const shop = shopData[shopName];
    if (shop) {
        res.json(shop.items);
    } else {
        res.status(404).json({ error: 'ショップが見つかりません' });
    }
});

app.get('/api/shop/:shopName', (req: Request, res: Response) => {
    const shopName = req.params.shopName;
    const shop = shopData[shopName];
    if (shop) {
        res.json({
            owner: shop.owner,
            items: shop.items,
            imageUrl: shop.imageUrl
        });
    } else {
        res.status(404).json({ error: 'ショップが見つかりません' });
    }
});

app.get('/api/shop/:shopName/items/:itemId', (req: Request, res: Response) => {
    const shopName = req.params.shopName;
    const itemId = parseInt(req.params.itemId);

    const shop = shopData[shopName];
    if (shop) {
        const item = shop.items.find(item => item.id === itemId);
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ error: 'アイテムが見つかりません' });
        }
    } else {
        res.status(404).json({ error: 'ショップが見つかりません' });
    }
});

app.put('/api/shop/:shopName', authenticate, async (req: Request, res: Response) => {
    const shopName = req.params.shopName;
    const { imageUrl } = req.body;

    try {
        await loadShopUserData();
        const shop = shopData[shopName];
        if (!shop) {
            return res.status(404).json({ error: 'ショップが見つかりません' });
        }

        shop.imageUrl = imageUrl;

        res.json({ message: 'ショップ情報を更新しました', shop: shop });
    } catch (error) {
        console.error("ショップ情報更新エラー:", error);
        res.status(500).json({ error: 'ショップ情報の更新に失敗しました' });
    }
});


// --- HTMLファイルを提供するルート ---

app.get('/shop/:shopName', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'shop.html'));
});

app.get('/shop/:shopName/items', (req: any, res: any) => {
    const shopName = req.params.shopName;
    if (!shopData[shopName]) {
        return res.status(404).send("ショップが見つかりません。");
    }
    res.sendFile(path.join(__dirname, 'public', 'items.html'));
});

app.get('/shop/:shopName/item/:itemId', (req: any, res: any) => {
    const shopName = req.params.shopName;
    if (!shopData[shopName]) {
        return res.status(404).send("ショップが見つかりません。");
    }
    res.sendFile(path.join(__dirname, 'public', 'item.html'));
});


const port = 80;
app.listen(port, () => console.log(`Webサーバー起動: ポート${port}`));