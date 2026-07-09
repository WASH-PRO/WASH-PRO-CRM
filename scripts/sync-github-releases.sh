#!/usr/bin/env bash
# Sync GitHub release titles and bilingual bodies from releases/vX.Y.Z.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for file in releases/v1.1.*.md; do
  [[ -f "$file" ]] || continue
  tag="$(basename "$file" .md)"
  title="$(head -1 "$file")"
  body_file="$(mktemp)"
  tail -n +3 "$file" > "$body_file"
  echo "Editing $tag …"
  gh release edit "$tag" --title "$title" --notes-file "$body_file"
  rm -f "$body_file"
done

echo "Done."
