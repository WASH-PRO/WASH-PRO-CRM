#!/bin/sh
set -e

PASSWD_FILE="/mosquitto/config/passwd"
ACL_FILE="/mosquitto/config/acl"
CONF="/mosquitto/config/mosquitto.conf"

file_mtime() {
  if [ -f "$1" ]; then
    date -r "$1" +%s 2>/dev/null || echo ""
  else
    echo ""
  fi
}

mosquitto -c "$CONF" &
MQ_PID=$!

last_passwd_mtime=""
last_acl_mtime=""
while kill -0 "$MQ_PID" 2>/dev/null; do
  sleep 2
  passwd_mtime=$(file_mtime "$PASSWD_FILE")
  acl_mtime=$(file_mtime "$ACL_FILE")
  if [ -n "$last_passwd_mtime" ] || [ -n "$last_acl_mtime" ]; then
    if [ "$passwd_mtime" != "$last_passwd_mtime" ] || [ "$acl_mtime" != "$last_acl_mtime" ]; then
      kill -HUP "$MQ_PID" 2>/dev/null || true
    fi
  fi
  last_passwd_mtime=$passwd_mtime
  last_acl_mtime=$acl_mtime
done

wait "$MQ_PID"
