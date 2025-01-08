import requests

url = "https://api.geysermc.org/v2/link/bedrock/2535452076642959"

try:
    response = requests.get(url)
    response.raise_for_status()  # エラーがあれば例外を発生させる

    data = response.json()  # レスポンスをJSONとして解析

    # ここで取得したデータを処理する
    print(data)

except requests.exceptions.RequestException as e:
    print(f"リクエストエラー: {e}")
except ValueError as e:
    print(f"JSON解析エラー: {e}")