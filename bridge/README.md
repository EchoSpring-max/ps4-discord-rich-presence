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

2. Copy `.env.example` to `.env`.
3. Set `SITE_URL` to your deployed Railway app URL.
4. Set `DISCORD_CLIENT_ID` to your Discord app's Client ID.
5. Start the bridge:

   ```powershell
   pnpm start
   ```

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

4. Put a `.env` file in the same folder as the `.exe`.

## Behavior

- Polls your hosted site every `POLL_INTERVAL_MS` milliseconds
- Reads `/api/state`
- If a PSN game is active, updates Discord Rich Presence
- If no game is active, clears the Rich Presence
