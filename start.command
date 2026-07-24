#!/bin/zsh
cd "$(dirname "$0")"
python3 -m http.server 8080 &
SERVER_PID=$!
sleep 1
open "http://localhost:8080"
wait $SERVER_PID
