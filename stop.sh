#!/bin/bash
# 停止城堡突袭本地服务器

cd "$(dirname "$0")"

PIDFILE=".server.pid"

if [ -f "$PIDFILE" ]; then
    SERVER_PID=$(cat "$PIDFILE")
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        kill "$SERVER_PID"
        echo "🛑 服务器已停止 (PID: $SERVER_PID)"
    else
        echo "⚠️ 服务器进程已不存在"
    fi
    rm -f "$PIDFILE"
else
    echo "⚠️ 没有找到运行中的服务器"
fi
