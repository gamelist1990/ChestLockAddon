let currentUser = null;
let selectedItem = null;
let selectedShopOwner = null;

function showLoginArea() {
    document.getElementById('login-area').style.display = 'block';
    document.getElementById('shop-management').style.display = 'none';
    document.getElementById('shop-list-area').style.display = 'none';
    document.getElementById('search-items').style.display = 'none';
    document.getElementById('purchase-modal').style.display = 'none';
    document.getElementById('shop-detail-modal').style.display = "none";
    document.getElementById('item-detail-section').style.display = "none";

}
function showShopManagementPanel() {
    if (!currentUser) {
        alert('ログインしてください。');
        return;
    }
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('shop-management').style.display = 'block';
    document.getElementById('shop-list-area').style.display = 'none';
    document.getElementById('search-items').style.display = 'none';
    document.getElementById('purchase-modal').style.display = 'none';
    document.getElementById('shop-detail-modal').style.display = "none";
    document.getElementById('item-detail-section').style.display = "none";
}


function showShopManagement() {
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('shop-management').style.display = 'block';
    document.getElementById('shop-list-area').style.display = 'none';
    document.getElementById('search-items').style.display = 'none';
    document.getElementById('purchase-modal').style.display = 'none';
    document.getElementById('shop-detail-modal').style.display = "none";
    document.getElementById('item-detail-section').style.display = "none";
}

function showShopListArea() {
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('shop-management').style.display = 'none';
    document.getElementById('shop-list-area').style.display = 'block';
    document.getElementById('search-items').style.display = 'none';
    document.getElementById('purchase-modal').style.display = 'none';
    document.getElementById('shop-detail-modal').style.display = "none";
    document.getElementById('item-detail-section').style.display = "none";
}
function showSearchItems() {
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('shop-management').style.display = 'none';
    document.getElementById('shop-list-area').style.display = 'none';
    document.getElementById('search-items').style.display = 'block';
    document.getElementById('purchase-modal').style.display = 'none';
    document.getElementById('shop-detail-modal').style.display = "none";
    document.getElementById('item-detail-section').style.display = "none";
}

function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password
        })
    })
        .then(res => res.json())
        .then(data => {
            alert(`${data.message}しましたログインしてください`);

            if (data.user) {
                currentUser = data.user;
            }
        })
        .catch(err => alert("登録エラー: " + err));
}

function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password
        })
    })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            if (data.message === 'ログイン成功') {
                currentUser = data.user;
                showShopManagementPanel();
                loadShopData();
                loadOtherShops();
                document.getElementById('shop-list-area').style.display = 'block';
                document.getElementById('login-area').style.display = 'none';
            }
        })
        .catch(err => alert("ログインエラー: " + err));
}



function createShop() {
    const username = currentUser.username;
    const password = document.getElementById('login-password').value;
    fetch('/createShop', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.message === "ショップ開設成功" || data.message === "すでにショップを開設済みです") {
                alert(data.message);
                currentUser = data.user;
                loadShopData();
                showShopContent();
                updateBalanceDisplay(data.user.money)
            } else {
                alert("ショップ開設エラー: " + (data.message || "不明なエラー"));
            }
        })
        .catch(err => alert("ショップ開設エラー: " + err));
}

function showShopContent() {
    document.getElementById('shop-content').style.display = 'block';
}

function updateBalanceDisplay(money) {
    if (money !== undefined) {
        document.getElementById('balance-value').textContent = money;
    } else {
        document.getElementById('balance-value').textContent = "取得できませんでした";
        console.warn("ユーザーの所持金を取得できませんでした");
    }
}


function loadShopData() {
    fetch('/shopData', {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: currentUser.username,
            password: document.getElementById("login-password").value
        })
    })
        .then(res => res.json())
        .then(data => {
            console.log(JSON.stringify(data))
            const itemsDiv = document.getElementById('items');
            itemsDiv.innerHTML = "";

            if (data.shopData && data.shopData.items) {
                if (data.shopData.items.length > 0) {
                    data.shopData.items.forEach(item => {
                        const itemDiv = document.createElement('div');
                        itemDiv.classList.add("item-card");

                        const buttonsDiv = document.createElement('div');
                        buttonsDiv.className = 'edit-delete-buttons';
                        buttonsDiv.innerHTML = `
    <button onclick="editItem('${item.name}')">編集</button>
    <button onclick="deleteItem('${item.name}')">削除</button>
    `;
                        itemDiv.appendChild(buttonsDiv);

                        itemDiv.innerHTML += `
    <p>商品名: ${item.name}</p>
    <p>価格: ${item.price}円</p>
    <p>在庫数: ${item.quantity}個</p>
    `;
                        itemsDiv.appendChild(itemDiv);
                        updateBalanceDisplay(data.shop.money)
                    });
                } else {
                    itemsDiv.textContent = "商品はまだありません。";
                }
            } else {
                itemsDiv.textContent = "ショップデータの取得に失敗しました。(まだお店を開店していない場合は開店してください)";
            }
        })
        .catch(error => {
            console.error("ショップデータの読み込みエラー:", error);
            const itemsDiv = document.getElementById('items');
            itemsDiv.innerHTML = "";
            itemsDiv.textContent = "ショップデータの取得に失敗しました。";
        });
}


async function buyItem(itemName, shopOwner) {
    selectedItem = itemName;
    selectedShopOwner = shopOwner;
    const modal = document.getElementById('purchase-modal');
    const modalItemDetails = document.getElementById('modal-item-details');
    modalItemDetails.innerHTML = `<p>商品名: ${itemName}</p><p>ショップ名:${shopOwner}</p>`;
    modal.style.display = "block";

}
async function confirmPurchase() {
    const itemName = selectedItem;
    const shopOwner = selectedShopOwner;
    const username = currentUser.username;
    const password = document.getElementById('login-password').value;
    const modal = document.getElementById('purchase-modal');

    try {
        const response = await fetch('/buy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemName,
                username: shopOwner,
                buyer: username,
                password
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: '購入エラー'
            }));
            alert(errorData.message || "購入エラー");
            return;
        }

        const data = await response.json();
        alert(data.message);

        loadShop(shopOwner);
        closeModal()
        updateBalanceDisplay(data.buyerBalance);
    } catch (error) {
        console.error("購入処理エラー:", error);
        alert("購入処理中にエラーが発生しました。");
    }
}
function closeModal() {
    document.getElementById('purchase-modal').style.display = "none";
}
function closeShopDetailModal() {
    document.getElementById('shop-detail-modal').style.display = "none";
    document.getElementById('item-detail-section').style.display = "none";
}


function updateShopData(shopData) { //loadShopDataと同じ処理
    const itemsDiv = document.getElementById('items');
    itemsDiv.innerHTML = "";

    if (shopData && shopData.items) {
        if (shopData.items.length > 0) {
            shopData.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add("item-card");


                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'edit-delete-buttons';
                buttonsDiv.innerHTML = `
    <button onclick="editItem('${item.name}')">編集</button>
    <button onclick="deleteItem('${item.name}')">削除</button>
    `;
                itemDiv.appendChild(buttonsDiv);
                itemDiv.innerHTML += `
    <p>商品名: ${item.name}</p>
    <p>価格: ${item.price}円</p>
    <p>在庫数: ${item.quantity}個</p>
    <button onclick="buyItem('${item.name}', '${shopOwner}')" class="buy-button">購入</button>
    `;
                itemsDiv.appendChild(itemDiv);
            });
        } else {
            itemsDiv.textContent = "商品はまだありません。";
        }
    } else {
        itemsDiv.textContent = "ショップデータの取得に失敗しました。";
    }
}


async function addItem() {
    const itemName = document.getElementById('itemName').value;
    const price = parseInt(document.getElementById('price').value, 10);
    const quantity = parseInt(document.getElementById('quantity').value, 10);

    if (!itemName || isNaN(price) || isNaN(quantity)) {
        alert('商品名、価格、数量を正しく入力してください。');
        return;
    }

    const username = currentUser.username;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/addItem', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemName,
                price,
                quantity,
                username,
                password
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: '商品追加エラー'
            }));
            alert(errorData.message || "商品追加エラー");
            return;
        }

        const data = await response.json();
        alert(data.message);
        loadShopData();

    } catch (error) {
        console.error("商品追加エラー:", error);
        alert("商品追加中にエラーが発生しました。");
    }
}

async function editItem(itemName) {
    const user = currentUser;
    const password = document.getElementById('login-password').value;
    const newPrice = prompt(`${itemName} の新しい価格を入力してください:`);
    const newQuantity = prompt(`${itemName} の新しい在庫数を入力してください:`);

    if (newPrice === null || newQuantity === null) {
        return;
    }

    const price = parseInt(newPrice);
    const quantity = parseInt(newQuantity);
    if (isNaN(price) || isNaN(quantity)) {
        alert("価格と在庫数は数値で入力してください。");
        return;
    }



    try {
        const response = await fetch('/editItem', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemName,
                price,
                quantity,
                username: user.username,
                password
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: '商品編集エラー'
            }));
            alert(errorData.message || "商品編集エラー");
            return;
        }


        const data = await response.json();
        alert(data.message);
        loadShopData();

    } catch (error) {
        console.error("商品編集エラー:", error);
        alert("商品編集中にエラーが発生しました。");
    }
}


async function deleteItem(itemName) {
    const password = document.getElementById('login-password').value;

    if (confirm(`${itemName} を本当に削除しますか？`)) {
        try {
            const response = await fetch('/deleteItem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    itemName,
                    username: currentUser.username,
                    password
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: '商品削除エラー'
                }));
                alert(errorData.message || "商品削除エラー");
                return;
            }

            const data = await response.json();
            alert(data.message);
            loadShopData();
        } catch (error) {
            console.error("商品削除エラー:", error);
            alert("商品削除中にエラーが発生しました。");
        }
    }
}


function loadOtherShops() {
    const password = document.getElementById("login-password").value;

    fetch('/otherShops', {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: currentUser.username,
            password: password
        })
    })
        .then(res => res.json())
        .then(data => {
            const shopListDiv = document.getElementById('shop-list');
            shopListDiv.innerHTML = "";

            if (data.shops && data.shops.length > 0) {
                data.shops.forEach(shop => {
                    const shopDiv = document.createElement('div');
                    shopDiv.classList.add('shop-item');

                    shopDiv.innerHTML = `<h3>${shop.username}のお店</h3>`;

                    const detailButton = document.createElement('button');
                    detailButton.textContent = "詳細を見る";
                    detailButton.onclick = () => openShopDetailModal(shop.username);
                    shopDiv.appendChild(detailButton);

                    shopListDiv.appendChild(shopDiv);
                });
            } else {
                shopListDiv.textContent = "他のショップはまだありません。";
            }
        })
        .catch(error => {
            console.error("他のショップの読み込みエラー:", error);
            document.getElementById('shop-list').textContent = "他のショップの読み込みに失敗しました。";
        });
}

async function openShopDetailModal(shopOwner) {
    const modal = document.getElementById('shop-detail-modal');
    const modalShopDetails = document.getElementById('modal-shop-details');
    modalShopDetails.innerHTML = 'ロード中...';
    modal.style.display = "block";

    try {
        const response = await fetch('/shopData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: shopOwner,
                buyerUsername: currentUser?.username || null
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: 'ショップ情報取得エラー'
            }));
            modalShopDetails.innerHTML = errorData.message || 'ショップ情報取得エラー';
            return;
        }
        const data = await response.json();
        if (data.shopData && data.shopData.items) {
            let shopHTML = `<h3>${shopOwner} の商品一覧</h3>`;
            shopHTML += '<ul>';
            data.shopData.items.forEach(item => {
                shopHTML += `<li>
                            ${item.name} - ${item.price}円 (残り${item.quantity}個)
                             <button onclick="buyItem('${item.name}', '${shopOwner}')" class="buy-button">購入</button>
                           </li>`;
            });
            shopHTML += '</ul>';

            modalShopDetails.innerHTML = shopHTML;
        } else {
            modalShopDetails.innerHTML = "このショップには商品がありません";
        }


    } catch (error) {
        console.error("ショップ詳細読み込みエラー:", error);
        modalShopDetails.innerHTML = 'ショップ詳細の取得に失敗しました。';
    }
}

async function loadShop(shopOwner) {
    const itemsDiv = document.getElementById('items');
    const itemDetailDiv = document.getElementById('item-detail-content')
    itemsDiv.innerHTML = ""; // 既存の内容をクリア
    itemDetailDiv.innerHTML = "";
    try {
        const response = await fetch('/shopData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: shopOwner,
                buyerUsername: currentUser?.username || null
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: '商品取得エラー'
            }));
            alert(errorData.message || "商品取得エラー");
            return;
        }

        const data = await response.json();
        if (data.shopData && data.shopData.items) {
            data.shopData.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('item-card');

                itemDiv.innerHTML += `
                    <p>商品名: ${item.name}</p>
                    <p>価格: ${item.price}円</p>
                    <p>在庫数: ${item.quantity}個</p>
                     <button onclick="showItemDetail('${item.name}', '${shopOwner}')" class="buy-button">詳細</button>
                `;
                itemsDiv.appendChild(itemDiv);
            });
        } else {
            itemsDiv.textContent = "このショップには商品がありません";
        }
        document.getElementById('item-detail-section').style.display = 'none';
        document.getElementById('shop-management').style.display = "block";
        document.getElementById("shop-content").style.display = "block";

    } catch (error) {
        console.error("ショップの読み込みエラー:", error);
        alert("ショップの読み込みに失敗しました。");
    }
}
async function showItemDetail(itemName, shopOwner) {
    const itemDetailDiv = document.getElementById('item-detail-content');
    itemDetailDiv.innerHTML = ''; // クリア
    const itemDetailSection = document.getElementById('item-detail-section');
    itemDetailSection.style.display = "block";


    try {
        const response = await fetch('/shopData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: shopOwner,
                buyerUsername: currentUser?.username || null
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: '商品取得エラー'
            }));
            itemDetailDiv.innerHTML = errorData.message || "商品取得エラー";
            return;
        }
        const data = await response.json();

        if (data.shopData && data.shopData.items) {

            const item = data.shopData.items.find(item => item.name === itemName);
            if (item) {
                itemDetailDiv.innerHTML = `
                                        <h3>商品詳細</h3>
                                        <p>商品名: ${item.name}</p>
                                        <p>価格: ${item.price}円</p>
                                        <p>在庫数: ${item.quantity}個</p>
                                        <button onclick="buyItem('${item.name}', '${shopOwner}')" class="buy-button">購入</button>
                                    `;

            } else {
                itemDetailDiv.innerHTML = '商品が見つかりません。';
            }


        } else {
            itemDetailDiv.innerHTML = 'ショップデータ取得エラー';
        }

    } catch (error) {
        console.error("ショップの読み込みエラー:", error);
        itemDetailDiv.innerHTML = "ショップ情報の取得に失敗しました。";
    }

}

async function searchItems() {
    const itemName = document.getElementById('search-item-name').value;
    const searchResultsDiv = document.getElementById('search-results');
    searchResultsDiv.innerHTML = ''; // 結果をクリア

    if (!itemName) {
        searchResultsDiv.textContent = '商品名を入力してください';
        return;
    }

    const password = document.getElementById('login-password').value;


    fetch('/otherShops', {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: currentUser?.username || '',
            password: password,
        }),
    })
        .then(res => res.json())
        .then(data => {

            if (data.shops && data.shops.length > 0) {
                let found = false;
                data.shops.forEach(shop => {
                    if (shop.items && shop.items.length > 0) {
                        shop.items.forEach(item => {
                            if (item.name.includes(itemName)) {
                                const itemDiv = document.createElement('div');
                                itemDiv.classList.add('item-card');

                                itemDiv.innerHTML = `
                                                        <p>ショップ名: ${shop.username}</p>
                                                        <p>商品名: ${item.name}</p>
                                                        <p>価格: ${item.price}円</p>
                                                        <p>在庫数: ${item.quantity}個</p>
                                                       <button onclick="buyItem('${item.name}', '${shop.username}')"  class="buy-button">購入</button>
                                                    `;

                                searchResultsDiv.appendChild(itemDiv);
                                found = true;
                            }

                        });
                    }
                });
                if (!found) {
                    searchResultsDiv.textContent = '該当する商品は見つかりませんでした';
                }
            } else {
                searchResultsDiv.textContent = 'ショップがありません';
            }
        })
        .catch(error => {
            console.error("商品の検索エラー:", error);
            searchResultsDiv.textContent = "商品の検索に失敗しました。";
        });

}

function showPurchaseHistory() {
    const password = document.getElementById("login-password").value;
    fetch('/purchaseHistory', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: currentUser.username,
            password: password
        })
    })
        .then(res => res.json())
        .then(data => {
            const historyDiv = document.getElementById('items'); // 例：既存のアイテム表示領域を使用
            historyDiv.innerHTML = ''; // 既存の内容をクリア

            if (data.purchaseHistory && data.purchaseHistory.length > 0) {
                const historyList = document.createElement('ul');
                data.purchaseHistory.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `購入者: ${item.buyer}, 商品: ${item.itemName}, 価格: ${item.price}円, 購入日時: ${new Date(item.purchaseDate).toLocaleString()}`;
                    historyList.appendChild(listItem);
                });
                historyDiv.appendChild(historyList);
            } else {
                historyDiv.textContent = '購入履歴はありません。';
            }
        })
        .catch(error => {
            console.error("購入履歴の取得エラー:", error);
            alert("購入履歴の取得に失敗しました。")
        });
}