# PS4 Tracker Web

A Railway-ready Node web app for tracking your PS4 library, syncing your played titles from PlayStation Network, and checking your currently active PSN game from a browser.

## What it does

- Hosts a browser dashboard instead of an Electron desktop app
- Stores PSN tokens and game library data on the server
- Imports your recently played PS4 titles from PSN
- Detects the PS4 game you are currently playing from PSN presence data
- Supports background polling so the hosted app can keep checking without your PC staying on

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
5. Deploy.

Railway will inject `PORT` automatically. The app already respects that variable.

## PSN setup

1. Sign in to PlayStation in your browser.
2. Open [https://ca.account.sony.com/api/v1/ssocookie](https://ca.account.sony.com/api/v1/ssocookie).
3. Copy the `npsso` value.
4. Paste it into the hosted app when you press `Connect PSN`.

## Notes

- This app uses unofficial PSN API wrappers and should be treated as a personal-use tool.
- The app does not ask for your PSN password directly.
- For Discord, use Sony's official PlayStation and Discord account link so your real console activity is shared by PlayStation itself.
