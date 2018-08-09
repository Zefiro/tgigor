#!/bin/bash
# This starts the Telegram bot Igor in a screen for the current user
# this script is intended to be called at bootup, e.g. from /etc/rc.local with:
# su -c /home/zefiro/tgigor/start_tgigor.sh zefiro

cd "$(dirname "$0")"

# -A: auto-resize screen
# -dm: starts a new screen session in detached mode
# -S: set session name
# -t: set title of window
screen -AdmS tgigor -t bot

# -S: specify session name
# -p: selects window by title
# -X: sends the command into the window
screen -S tgigor -p bot -X stuff $'npm start\n'
