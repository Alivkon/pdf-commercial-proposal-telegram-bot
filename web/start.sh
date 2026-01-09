#!/bin/bash

# Скрипт запуска веб-сервера базы компаний

PORT=${WEB_PORT:-3001}

echo "========================================="
echo "  Запуск веб-сервера базы компаний"
echo "========================================="
echo ""

# Проверка, не запущен ли уже сервер
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Порт $PORT уже занят!"
    echo ""
    echo "Процессы на порту $PORT:"
    lsof -Pi :$PORT -sTCP:LISTEN
    echo ""
    read -p "Хотите убить процесс и запустить заново? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t)
        kill -9 $PID
        echo "✓ Процесс остановлен"
        sleep 1
    else
        echo "Выход..."
        exit 1
    fi
fi

# Запуск сервера
echo "🚀 Запуск сервера на порту $PORT..."
echo ""

WEB_PORT=$PORT node server.js
