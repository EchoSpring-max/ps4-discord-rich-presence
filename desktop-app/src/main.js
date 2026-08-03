const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");

const { DiscordPresenceManager } = require("./discord");
const { PsnManager } = require("./psn");
const { Store } = require("./store");

let mainWindow;
let store;
let psn;
let pollTimer = null;
const discord = new DiscordPresenceManager();

function normalizeGame(input = {}) {
  return {
    id: input.id || `game-${Date.now()}`,
    title: (input.title || "").trim(),
    platform: (input.platform || "PS4").trim() || "PS4",
    status: (input.status || "Backlog").trim() || "Backlog",
    hoursPlayed: Number(input.hoursPlayed || 0),
    presenceState: (input.presenceState || "").trim(),
    notes: (input.notes || "").trim(),
    largeImageKey: (input.largeImageKey || "").trim(),
    largeImageText: (input.largeImageText || "").trim(),
    smallImageKey: (input.smallImageKey || "").trim(),
    smallImageText: (input.smallImageText || "").trim(),
    imageUrl: (input.imageUrl || "").trim(),
    titleId: (input.titleId || "").trim(),
    source: (input.source || "manual").trim(),
    playCount: Number(input.playCount || 0),
    playDuration: (input.playDuration || "").trim(),
    firstPlayedAt: input.firstPlayedAt || null,
    lastPlayedAt: input.lastPlayedAt || null,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function getState() {
  return store.getState();
}

function saveState(nextState) {
  store.setState(nextState);
  return store.getState();
}

async function syncDiscordPresence(state = getState()) {
  const synced = await discord.syncPresence(state.settings.discord, state.psnPresence);

  return saveState({
    ...state,
    settings: {
      ...state.settings,
      discord: {
        ...state.settings.discord,
        lastRichPresenceAt: synced ? new Date().toISOString() : state.settings.discord.lastRichPresenceAt,
      },
    },
  });
}

function restartPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  const state = getState();
  const intervalMs = Math.max(5000, Number(state.settings.discord.pollIntervalMs || 15000));

  pollTimer = setInterval(async () => {
    const latest = getState();
    if (!latest.settings.discord.autoSync || !latest.settings.psn.accessToken) {
      return;
    }

    try {
      const detected = await psn.detectCurrentGame();
      await syncDiscordPresence(detected.state);
    } catch (_error) {
      // Keep polling even if one check fails.
    }
  }, intervalMs);
}

function installIpc() {
  ipcMain.handle("tracker:get-state", async () => getState());

  ipcMain.handle("tracker:save-game", async (_event, game) => {
    const current = getState();
    const nextGame = normalizeGame(game);

    if (!nextGame.title) {
      throw new Error("Game title is required.");
    }

    const existingIndex = current.games.findIndex((item) => item.id === nextGame.id);
    const games = [...current.games];

    if (existingIndex >= 0) {
      games[existingIndex] = {
        ...games[existingIndex],
        ...nextGame,
      };
    } else {
      games.unshift(nextGame);
    }

    return saveState({
      ...current,
      games,
    });
  });

  ipcMain.handle("tracker:delete-game", async (_event, gameId) => {
    const current = getState();

    return saveState({
      ...current,
      games: current.games.filter((item) => item.id !== gameId),
      psnPresence:
        current.psnPresence && `psn-${current.psnPresence.titleId}` === gameId ? null : current.psnPresence,
    });
  });

  ipcMain.handle("tracker:save-settings", async (_event, settings) => {
    const current = getState();
    const nextState = saveState({
      ...current,
      settings: {
        ...current.settings,
        ...settings,
        psn: {
          ...current.settings.psn,
          ...((settings && settings.psn) || {}),
        },
        discord: {
          ...current.settings.discord,
          ...((settings && settings.discord) || {}),
        },
      },
    });

    restartPolling();
    return syncDiscordPresence(nextState);
  });

  ipcMain.handle("tracker:connect-psn", async (_event, npsso) => {
    const nextState = await psn.connectWithNpsso(npsso);
    restartPolling();
    return nextState;
  });

  ipcMain.handle("tracker:sync-psn-library", async () => {
    return psn.syncLibrary();
  });

  ipcMain.handle("tracker:detect-current-psn-game", async () => {
    const result = await psn.detectCurrentGame();
    return {
      ...result,
      state: await syncDiscordPresence(result.state),
    };
  });

  ipcMain.handle("tracker:sync-discord-presence", async () => {
    return syncDiscordPresence();
  });
}

app.whenReady().then(() => {
  store = new Store(path.join(app.getPath("userData"), "tracker-data.json"));
  store.load();
  psn = new PsnManager({ getState, saveState });
  installIpc();
  createWindow();
  restartPolling();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  await discord.disconnect();
});
