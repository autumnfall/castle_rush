#!/bin/bash
# 启动城堡突袭本地服务器

cd "$(dirname "$0")"

PORT=8080
PIDFILE=".server.pid"

# 检查是否已有服务器在运行
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "服务器已在运行 (PID: $OLD_PID)，访问 http://localhost:$PORT"
        exit 0
    else
        rm -f "$PIDFILE"
    fi
fi

# 启动 HTTP 服务器
python3 -m http.server "$PORT" > /dev/null 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDFILE"

echo "🚀 服务器已启动！"
echo "🌐 访问地址: http://localhost:$PORT"
echo "🛑 停止服务器请运行: ./stop.sh"
