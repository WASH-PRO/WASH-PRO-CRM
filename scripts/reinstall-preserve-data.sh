#!/usr/bin/env bash
# Полная переустановка WASH-PRO-CRM с GitHub с сохранением DATA_DIR и секретов из .env.
# Запуск на сервере: sudo bash scripts/reinstall-preserve-data.sh
#
# Перед удалением сохраняет:
#   - путь DATA_DIR (в backup/.data-dir-path)
#   - копию .env, docker-compose.override.yml, local/
set -euo pipefail

PROJECT_DIR="${WASH_PROJECT_DIR:-/opt/wash-pro-crm}"
REPO_URL="${WASH_REPO_URL:-https://github.com/WASH-PRO/WASH-PRO-CRM.git}"
BRANCH="${WASH_BRANCH:-main}"

read_data_dir() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo "./data"
    return
  fi
  local val
  val="$(grep -E '^DATA_DIR=' "$env_file" | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//; s/["'\'']$//')"
  if [ -n "$val" ]; then
    echo "$val"
  else
    echo "./data"
  fi
}

resolve_abs() {
  local p="$1"
  if [[ "$p" = /* ]]; then
    echo "$p"
  else
    echo "$(cd "$(dirname "$PROJECT_DIR/$p")" 2>/dev/null && pwd)/$(basename "$p")" 2>/dev/null || echo "$PROJECT_DIR/$p"
  fi
}

if [ -d "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/.env" ]; then
  DATA_DIR_RAW="$(read_data_dir "$PROJECT_DIR/.env")"
else
  DATA_DIR_RAW="${DATA_DIR:-/mnt/hdd/data}"
fi

if [[ "$DATA_DIR_RAW" = /* ]]; then
  DATA_DIR_ABS="$DATA_DIR_RAW"
else
  DATA_DIR_ABS="$(resolve_abs "$DATA_DIR_RAW")"
fi

BACKUP_ROOT="${DATA_DIR_ABS}/.wash-pro-reinstall-backup"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

echo "=== WASH PRO CRM — переустановка с сохранением данных ==="
echo "Проект:     $PROJECT_DIR"
echo "DATA_DIR:   $DATA_DIR_ABS"
echo "Backup:     $BACKUP_DIR"
echo ""

mkdir -p "$BACKUP_DIR"
printf '%s\n' "$DATA_DIR_ABS" > "$BACKUP_DIR/.data-dir-path"
echo "[backup] DATA_DIR сохранён: $DATA_DIR_ABS"

if [ -d "$PROJECT_DIR" ]; then
  [ -f "$PROJECT_DIR/.env" ] && cp -a "$PROJECT_DIR/.env" "$BACKUP_DIR/.env"
  [ -f "$PROJECT_DIR/docker-compose.override.yml" ] && cp -a "$PROJECT_DIR/docker-compose.override.yml" "$BACKUP_DIR/"
  [ -d "$PROJECT_DIR/local" ] && cp -a "$PROJECT_DIR/local" "$BACKUP_DIR/"
  echo "[backup] .env / override / local скопированы"
fi

if [ -d "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
  echo "[docker] Остановка контейнеров CRM…"
  cd "$PROJECT_DIR"
  set -a
  # shellcheck disable=SC1091
  [ -f .env ] && source .env
  set +a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/scripts/compose-files.sh" 2>/dev/null || true
  docker compose ${COMPOSE_FILES:-} down --remove-orphans 2>/dev/null || docker compose down --remove-orphans || true
fi

echo "[docker] Удаление образов wash-* (контейнеры уже остановлены)…"
docker ps -aq --filter 'name=wash-' | xargs -r docker rm -f 2>/dev/null || true
docker images --format '{{.Repository}}:{{.Tag}}' | grep -E 'wash-pro-crm|wash-' | xargs -r docker rmi -f 2>/dev/null || true

echo "[project] Удаление каталога проекта (DATA_DIR не трогаем)…"
if [ -d "$PROJECT_DIR" ]; then
  rm -rf "$PROJECT_DIR"
fi

echo "[project] Клонирование из GitHub…"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$PROJECT_DIR"
cd "$PROJECT_DIR"
chmod +x scripts/*.sh 2>/dev/null || true

if [ -f "$BACKUP_DIR/.env" ]; then
  cp -a "$BACKUP_DIR/.env" "$PROJECT_DIR/.env"
  echo "[restore] .env восстановлен"
else
  cp .env.example .env
  echo "[restore] создан .env из .env.example — проверьте секреты!"
fi

# Гарантируем DATA_DIR и путь проекта
if grep -q '^DATA_DIR=' "$PROJECT_DIR/.env"; then
  sed -i "s|^DATA_DIR=.*|DATA_DIR=$DATA_DIR_ABS|" "$PROJECT_DIR/.env"
else
  printf '\nDATA_DIR=%s\n' "$DATA_DIR_ABS" >> "$PROJECT_DIR/.env"
fi
if grep -q '^WASH_HOST_PROJECT_ROOT=' "$PROJECT_DIR/.env"; then
  sed -i "s|^WASH_HOST_PROJECT_ROOT=.*|WASH_HOST_PROJECT_ROOT=$PROJECT_DIR|" "$PROJECT_DIR/.env"
else
  printf 'WASH_HOST_PROJECT_ROOT=%s\n' "$PROJECT_DIR" >> "$PROJECT_DIR/.env"
fi

[ -f "$BACKUP_DIR/docker-compose.override.yml" ] && cp -a "$BACKUP_DIR/docker-compose.override.yml" "$PROJECT_DIR/"
[ -d "$BACKUP_DIR/local" ] && cp -a "$BACKUP_DIR/local" "$PROJECT_DIR/"

echo "[start] Запуск ./scripts/start.sh …"
"$PROJECT_DIR/scripts/start.sh"

echo ""
echo "=== Готово ==="
echo "DATA_DIR (не изменён): $DATA_DIR_ABS"
echo "Резервная копия настроек: $BACKUP_DIR"
echo "Dashboard: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${DASHBOARD_PORT:-80}"
echo "Проверка: curl -s http://127.0.0.1/version.json && curl -s http://127.0.0.1/api/health"
