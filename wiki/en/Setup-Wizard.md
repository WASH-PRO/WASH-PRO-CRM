> **English** · **[Русский](../ru/Setup-Wizard.md)**

# Setup Wizard

Full documentation: [docs/setup-wizard.md](https://wash-pro.github.io/WASH-PRO-CRM/en/setup-wizard/)

After the first login — `/setup` until initial configuration is complete.

## Steps

Start → Infrastructure → Site → Posts (MQTT logins) → Currency → MQTT (sync) → Reference data → Done.

## Roles

- **Administrator / Operator** — full wizard, completion
- **Viewer** — view only + acknowledgment confirmation

## Re-run

`/setup?restart=1` or **System → Setup Wizard**.

## MQTT

"Sync MQTT" — updates Mosquitto passwd and ACL (post isolation by serial).
