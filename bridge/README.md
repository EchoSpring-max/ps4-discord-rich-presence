# Discord Bridge

This local helper reads the currently detected PSN game from your hosted tracker site and publishes it to Discord Rich Presence through the locally running Discord desktop app.

## Requirements

- Windows, macOS, or Linux machine with Discord desktop installed and running
- A Discord application Client ID from the Discord Developer Portal
- Your hosted PS4 tracker site URL

## Setup

1. Install dependencies:

   ```powershell
   pnpm install
   ```

2. Start the bridge:

   ```powershell
   pnpm start
   ```

3. Your browser opens a local setup page automatically.
4. In most cases, only enter:
   - your `Discord application Client ID`
   - your site password, if you enabled site protection
5. Leave the default site URL and `admin` username unless you changed them yourself.
6. Click `Save Setup`.

For the most reliable image, upload your PlayStation picture to your Discord application's Rich Presence assets with the key `playstation`. The bridge now defaults to that key.

## Build a Windows EXE

1. Install dependencies:

   ```powershell
   pnpm install
   ```

2. Build the executable:

   ```powershell
   pnpm build:win
   ```

3. The output will be:

   ```text
   bridge/dist/ps4-discord-bridge.exe
   ```

4. Run the `.exe`.
5. A local setup page opens automatically.
6. The bridge saves your settings to `config.json` next to the `.exe`.

## Behavior

- Hosts a local setup UI at `http://127.0.0.1:3487`
- Saves bridge settings to `config.json`
- Polls your hosted site every `POLL_INTERVAL_MS` milliseconds
- Reads `/api/state`
- Supports HTTP Basic Auth when `SITE_PASSWORD` is set
- If a PSN game is active, updates Discord Rich Presence
- If no game is active, clears the Rich Presence
