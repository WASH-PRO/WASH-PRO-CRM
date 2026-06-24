#!/usr/bin/env bash
# Re-apply WASH-PHO-CRM UI patches to vendored dynamic-api/frontend after upstream sync.
set -euo pipefail

DA="${1:?usage: apply-wash-embedded-ui.sh <dynamic-api-dir>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
P="$ROOT/patches/wash-embedded"

cp "$P/WashSoftwareUpdatesSection.tsx" "$DA/frontend/src/components/"
cp "$P/UpdateBanner.tsx" "$DA/frontend/src/components/"

# vite-env.d.ts — VITE_WASH_EMBEDDED
if ! grep -q 'VITE_WASH_EMBEDDED' "$DA/frontend/src/vite-env.d.ts" 2>/dev/null; then
  perl -i -pe 's/(readonly VITE_API_URL: string;)/$1\n  readonly VITE_WASH_EMBEDDED?: string;/' \
    "$DA/frontend/src/vite-env.d.ts"
fi

SETTINGS="$DA/frontend/src/pages/SettingsPage.tsx"
if ! grep -q 'washEmbedded' "$SETTINGS"; then
  perl -i -pe 's|from '\''../components/UI'\'';|from '\''../components/UI'\'';\nimport WashSoftwareUpdatesSection from '\''../components/WashSoftwareUpdatesSection'\'';\n\nconst washEmbedded = import.meta.env.VITE_WASH_EMBEDDED === '\''true'\'';|' "$SETTINGS"
  perl -i -0pe 's|<SettingSection title="Software Updates" icon=\{ArrowUpCircle\}>|<SettingSection title="Software Updates" icon={ArrowUpCircle}>\n          {washEmbedded ? (\n            <WashSoftwareUpdatesSection updateStatus={updateStatus} />\n          ) : (\n          <|' "$SETTINGS"
  perl -i -0pe 's|(Deploy from a git clone or release archive — updates are applied automatically with rollback on failure\.\n          </p>\n        </SettingSection>)|Deploy from a git clone or release archive — updates are applied automatically with rollback on failure.\n          </p>\n          </>\n          )}\n        </SettingSection>|' "$SETTINGS"
  echo "==> Patched SettingsPage.tsx for WASH embedded UI"
fi

echo "==> WASH embedded UI patches applied"
