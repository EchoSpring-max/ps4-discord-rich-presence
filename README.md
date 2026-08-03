# PS4 Tracker Web

A Railway-ready Node web app for tracking your PS4 library, syncing your played titles from PlayStation Network, and checking your currently active PSN game from a browser.

## What it does

- Hosts a browser dashboard instead of an Electron desktop app
- Stores PSN tokens and game library data on the server
- Keeps the original NPSSO token server-side as a re-auth fallback when refresh tokens expire
- Imports your recently played PS4 titles from PSN
- Detects the PS4 game you are currently playing from PSN presence data
- Supports background polling so the hosted app can keep checking without your PC staying on
- Includes an optional local desktop bridge for Discord Rich Presence

## Local run

```powershell
pnpm install
pnpm start
```

The app runs on `http://localhost:3000` by default.

## Railway deployment

1. Push this folder to a GitHub repo.
2. Create a new Railway project from that repo.
3. Set a persistent volume and mount it to `/app/data` or another path.
4. Set `DATA_DIR=/app/data` in Railway variables.
5. Optional but recommended: set `SITE_USERNAME=admin` and choose a strong `SITE_PASSWORD`.
6. Deploy.

Railway will inject `PORT` automatically. The app already respects that variable.

When `SITE_PASSWORD` is set, the whole site and API are protected with HTTP Basic Auth. The health endpoint at `/health` stays open for uptime checks.

## Discord Rich Presence bridge

Discord Rich Presence still has to be published from a machine running the Discord desktop app locally. This repo includes a lightweight bridge in `bridge/` that polls your hosted site and mirrors the detected PSN game into Discord Rich Presence.

### Bridge setup

1. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy the application Client ID.
3. Optional but recommended: add Rich Presence art assets in the Discord app settings.
4. On the PC where Discord is installed, open the `bridge/` folder.
5. Install dependencies:

   ```powershell
   pnpm install
   ```

6. Copy `.env.example` to `.env` and set:

   ```powershell
   SITE_URL=https://your-railway-site.up.railway.app
   DISCORD_CLIENT_ID=your_discord_application_id
   SITE_USERNAME=admin
   SITE_PASSWORD=your_site_password
   ```

7. Start the bridge:

   ```powershell
   pnpm start
   ```

The bridge polls `/api/state` on your hosted site and updates Discord when the active PSN game changes.

## PSN setup

1. Sign in to PlayStation in your browser.
2. Open [https://ca.account.sony.com/api/v1/ssocookie](https://ca.account.sony.com/api/v1/ssocookie).
3. Copy the `npsso` value.
4. Paste it into the hosted app when you press `Connect PSN`.

If that page returns JSON, copy the value next to `"npsso"`. If it errors, make sure you are already signed into the same PlayStation account in that browser first.

After you connect once, the app now keeps the NPSSO token on the server volume and uses it as a fallback to re-authenticate automatically if the stored refresh token expires. The raw NPSSO token is not sent back to the browser API responses.

## Notes

- This app uses unofficial PSN API wrappers and should be treated as a personal-use tool.
- The app does not ask for your PSN password directly.
- For the most reliable no-PC Discord display, use Sony's official PlayStation and Discord account link.
- For custom Rich Presence text/images, use the local bridge in `bridge/`.
