# PS4 Discord Tracker Desktop

This is the all-local version of the project: one Electron app with a simple GUI, local PSN token storage, PS4 library sync, current-game detection, and Discord Rich Presence updates.

## What it does

- Stores your PSN session locally so you usually only paste your `npsso` token once
- Imports your PS4 library from PSN
- Detects the PS4 game you are currently playing
- Pushes that game into Discord Rich Presence from the same desktop app
- Keeps your Discord Client ID and sync settings saved between launches

## Quick setup

1. Install dependencies:

   ```powershell
   pnpm install
   ```

2. Start the desktop app:

   ```powershell
   pnpm start
   ```

3. Open Discord on the same PC.
4. Create a Discord application in the [Discord Developer Portal](https://discord.com/developers/applications) and copy its Client ID.
5. In that Discord application, upload a Rich Presence image asset with the key `playstation`.
6. Sign in to PlayStation in your browser.
7. Open [https://ca.account.sony.com/api/v1/ssocookie](https://ca.account.sony.com/api/v1/ssocookie) and copy the `npsso` value.
8. Paste the `npsso` into the app and press `Connect PSN`.
9. Paste your Discord Client ID into the app and press `Save Settings`.
10. Use `Sync Library`, `Detect Current Game`, or `Sync Discord`.

## Build a Windows executable

```powershell
pnpm build
```

The portable `.exe` is written to `desktop-app/dist/`.

## Notes

- This app uses unofficial PSN API wrappers and is meant for personal use.
- The app does not ask for your PSN password directly.
- Discord Rich Presence only updates while this local desktop app is running.
