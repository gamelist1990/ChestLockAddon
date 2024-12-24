import asyncio
import json
import math
import os
import socket
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import aiohttp
from aiohttp import web
import websockets
import numpy as np

HTTP_PORT = 19133
WS_PORT = 19134
API_BASE_URL = "http://localhost:5000/api/get"  # 外部APIサーバー 要書き換え

user_positions = []
cached_player_list = []
websocket_server = None
loop = None
executor = ThreadPoolExecutor()
connected_websockets = set()  # 接続中の WebSocket を追跡するセット

async def fetch_data(endpoint, options=None):
    url = f"{API_BASE_URL}/{endpoint}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=options) as response:
                if response.status != 200:
                    try:
                        error_data = await response.json()
                    except:
                        error_data = {"error": "Failed to parse error response."}
                    raise Exception(f"HTTP error {response.status} fetching {url}: {json.dumps(error_data)}")
                return await response.json()
    except Exception as error:
        print(f"Error fetching {url}:", error)
        return None

async def get_player_data(player_name):
    return await fetch_data(f"WorldPlayer?playerName={player_name}")

async def get_player_list():
    global cached_player_list
    player_list = await fetch_data("playerList")
    if player_list:
        cached_player_list = [player["name"] for player in player_list]
    return cached_player_list

def get_volume_by_distance(distance, max_distance=30, max_volume=1.0, min_volume=0.01):
    if distance > max_distance:
        return min_volume
    volume = max_volume / (1 + math.pow(distance, 2))
    return max(volume, min_volume)

def calculate_distance(user1_pos, user2_pos):
    return math.sqrt(
        (user1_pos["x"] - user2_pos["x"]) ** 2 +
        (user1_pos["y"] - user2_pos["y"]) ** 2 +
        (user1_pos["z"] - user2_pos["z"]) ** 2
    )

def get_nearby_users(current_user):
    global user_positions
    current_user_position = next((u["position"] for u in user_positions if u["username"] == current_user), None)
    if not current_user_position:
        return []

    return [
        {
            "username": u["username"],
            "distance": calculate_distance(current_user_position, u["position"])
        }
        for u in user_positions
        if u["username"] != current_user and calculate_distance(current_user_position, u["position"]) <= 30
    ]

async def send_player_list(request):
    try:
        player_list = await get_player_list()
        return web.json_response({"players": player_list})
    except Exception as error:
        print("プレイヤーリストの取得に失敗しました:", error)
        return web.json_response({"message": "Internal Server Error"}, status=500)

async def send_file(request):
    filename = request.match_info.get('filename', 'index.html')
    filepath = os.path.join(os.path.dirname(__file__), filename)

    try:
      with open(filepath, 'rb') as f:
          return web.Response(body=f.read(), content_type="text/html")
    except FileNotFoundError:
        return web.Response(text="File not found", status=404)

async def handle_websocket(websocket):
    global user_positions, connected_websockets
    # 'Origin' ヘッダーと path を組み合わせて URL を再構築
    origin = websocket.request.headers.get('Origin', '')  # request 経由で headers にアクセス
    path = websocket.request.path
    parsed_url = urlparse(f"{origin}{path}")
    username = parsed_url.query.split("username=")[1] if "username=" in parsed_url.query else None

    if not username:
        await websocket.close(code=1008, reason="Username is required")
        return

    websocket.username = username

    user_positions.append({"username": username, "position": {"x": 0, "y": 0, "z": 0}})

    print(f"{username} が接続しました")

    await websocket.send(json.dumps({"type": "playerList", "players": cached_player_list}))

    await broadcast_user_list()
    
    connected_websockets.add(websocket)

    try:
        async for message in websocket:
            if isinstance(message, websockets.Data):
                try:
                    if isinstance(message, str):
                        data = json.loads(message)
                        if data["type"] == "setPosition":
                            position = data["position"]
                            if (
                                position and
                                isinstance(position["x"], (int, float)) and
                                isinstance(position["y"], (int, float)) and
                                isinstance(position["z"], (int, float))
                            ):
                                user_index = next((i for i, u in enumerate(user_positions) if u["username"] == username), -1)
                                if user_index != -1:
                                    user_positions[user_index]["position"] = position
                                    await broadcast_user_list()
                            else:
                                print(f"Invalid position data received from {username}:", position)
                    else:
                        # 音声データを送信元以外の近接ユーザーにのみブロードキャスト
                        await broadcast_audio_data(username, message)
                except json.JSONDecodeError:
                    print("Failed to parse message")
            else:
                print(f"Unsupported message type received from {username}:", type(message))

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print(f"{username} が切断しました")
        user_positions = [u for u in user_positions if u["username"] != username]
        connected_websockets.remove(websocket)
        await broadcast_user_list()

async def broadcast_user_list():
    for ws in connected_websockets:
        if hasattr(ws, 'username'):
            nearby_users = get_nearby_users(ws.username)
            try:
                await ws.send(json.dumps({"type": "userList", "users": nearby_users}))
            except Exception as e:
                print(f"Error sending user list to {ws.username}: {e}")



async def broadcast_audio_data(sender, audio_data):
    global user_positions
    sender_position = next((u["position"] for u in user_positions if u["username"] == sender), None)

    if sender_position:
        nearby_users = get_nearby_users(sender)
        for user in nearby_users:
            user_socket = find_socket_by_username(user["username"])
            if user_socket:
                receiver_position = next((u["position"] for u in user_positions if u["username"] == user["username"]), None)
                if receiver_position:
                    distance = calculate_distance(sender_position, receiver_position)
                    volume = get_volume_by_distance(distance, max_volume=0.5)  # 最大音量を0.5に設定
                    adjusted_audio_data = await adjust_volume(audio_data, volume)

                    # 送信するデータを確認 (先頭の数バイトを出力)
                    # print(f"Sending audio data to {user['username']}: {adjusted_audio_data[:16]}")

                    if adjusted_audio_data[:4] == b'OggS':
                        print(f"Valid Opus header found for {user['username']}")
                    else:
                        print(f"Invalid Opus header for {user['username']}: {adjusted_audio_data[:4]}")
                    try:
                        await user_socket.send(adjusted_audio_data)
                    except Exception as e:
                        print(f"Error sending audio data to {user['username']}: {e}")
                else:
                    print(f"Could not find position for user: {user['username']}")
            else:
                print(f"Could not find socket for user: {user['username']}")
    else:
        print(f"Could not find position for user: {sender}")

async def adjust_volume(audio_data, volume):
    # Opus ヘッダーを解析してデータ部分の開始位置を探す
    if audio_data[:4] != b'OggS':
        print("Not an Ogg Opus file")
        return audio_data  # Opus データでない場合はそのまま返す

    # 簡易的なヘッダーチェック: ヘッダーサイズが小さいと仮定してスキップ
    header_size = 50
    audio_frames = audio_data[header_size:]

    # 音声データを NumPy 配列に変換 (16ビット整数を仮定)
    audio_np = np.frombuffer(audio_frames, dtype=np.int16)

    # 音量を調整
    adjusted_audio_np = np.round(audio_np * volume).astype(np.int16)

    # 調整された音声データをバイト列に戻す
    adjusted_audio_data = adjusted_audio_np.tobytes()

    return audio_data[:header_size] + adjusted_audio_data

def find_socket_by_username(username):
    for ws in connected_websockets:
        if hasattr(ws, 'username') and ws.username == username and not ws.closed:
            return ws
    return None

def get_local_ip_address():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
    except:
        ip_address = None
    finally:
        s.close()
    return ip_address

async def background_task():
    while True:
        await get_player_list()
        await broadcast_user_list()
        await asyncio.sleep(5)

async def update_positions():
  global user_positions
  while True:
        for user_position in user_positions:
            player_data_array = await get_player_data(user_position["username"])
            if isinstance(player_data_array, list) and len(player_data_array) > 0 and player_data_array[0].get("position"):
                player_data = player_data_array[0]
                user_position["position"] = {
                    "x": player_data["position"]["x"],
                    "y": player_data["position"]["y"],
                    "z": player_data["position"]["z"]
                }
            else:
                print(f"Invalid player data for {user_position['username']}:", player_data_array)

        await broadcast_user_list()
        await asyncio.sleep(1)

async def main():
    global websocket_server
    global loop

    loop = asyncio.get_running_loop()

    app = web.Application()
    app.router.add_get('/playerList', send_player_list)
    app.router.add_get('/{filename:.+}', send_file)
    app.router.add_get('/', send_file)

    runner = web.AppRunner(app)
    await runner.setup()
    http_site = web.TCPSite(runner, "0.0.0.0", HTTP_PORT)
    await http_site.start()
    print(f"HTTP Server listening on port {HTTP_PORT}")

    websocket_server = await websockets.serve(handle_websocket, "0.0.0.0", WS_PORT, subprotocols=["binary"])
    print(f"WebSocket Server listening on port {WS_PORT}")

    ip_address = get_local_ip_address()
    if ip_address:
      print(f"Server IP Address: {ip_address}:{HTTP_PORT} (HTTP)")
      print(f"Server IP Address: {ip_address}:{WS_PORT} (WebSocket)")
    else:
      print("Unable to retrieve server IP address.")

    await asyncio.gather(
        background_task(),
        update_positions(),
    )

if __name__ == "__main__":
    asyncio.run(main())