const express = require("express");
const path = require("path");

const { PsnManager } = require("./psn");
const { Store } = require("./store");

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const siteUsername = (process.env.SITE_USERNAME || "admin").trim();
const sitePassword = (process.env.SITE_PASSWORD || "").trim();
const store = new Store(path.join(dataDir, "tracker-data.json"));
store.load();

const psn = new PsnManager({
  getState: () => store.getState(),
  saveState: (nextState) => store.setState(nextState),
});

let pollingTimer = null;

function normalizeGame(input = {}) {
  return {
    id: input.id || `game-${Date.now()}`,
    titleId: (input.titleId || "").trim(),
    title: (input.title || "").trim(),
    platform: (input.platform || "PS4").trim() || "PS4",
    status: (input.status || "Backlog").trim() || "Backlog",
    hoursPlayed: Number(input.hoursPlayed || 0),
    presenceState: (input.presenceState || "").trim(),
    notes: (input.notes || "").trim(),
    imageUrl: (input.imageUrl || "").trim(),
    playCount: Number(input.playCount || 0),
    playDuration: (input.playDuration || "").trim(),
    source: (input.source || "manual").trim(),
    firstPlayedAt: input.firstPlayedAt || null,
    lastPlayedAt: input.lastPlayedAt || null,
  };
}

function saveState(nextState) {
  return store.setState(nextState);
}

function parseBasicAuth(headerValue = "") {
  if (!headerValue.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = Buffer.from(headerValue.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch (_error) {
    return null;
  }
}

function requireSiteAuth(req, res, next) {
  if (!sitePassword) {
    next();
    return;
  }

  const credentials = parseBasicAuth(req.headers.authorization || "");
  const authorized =
    credentials &&
    credentials.username === siteUsername &&
    credentials.password === sitePassword;

  if (authorized) {
    next();
    return;
  }

  res.set("WWW-Authenticate", 'Basic realm="PS4 Tracker"');
  res.status(401).send("Authentication required.");
}

function schedulePolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  const state = store.getState();
  const polling = state.settings.polling;
  if (!polling.enabled) {
    return;
  }

  const intervalMs = Math.max(1, Number(polling.intervalMinutes || 5)) * 60 * 1000;
  pollingTimer = setInterval(async () => {
    try {
      await psn.detectCurrentGame();
      const latest = store.getState();
      saveState({
        ...latest,
        settings: {
          ...latest.settings,
          polling: {
            ...latest.settings.polling,
            lastRunAt: new Date().toISOString(),
            lastError: "",
          },
        },
      });
    } catch (error) {
      const latest = store.getState();
      saveState({
        ...latest,
        settings: {
          ...latest.settings,
          polling: {
            ...latest.settings.polling,
            lastRunAt: new Date().toISOString(),
            lastError: error.message,
          },
        },
      });
      console.warn("Polling failed:", error.message);
    }
  }, intervalMs);
}

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

  requireSiteAuth(req, res, next);
});
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/state", (_req, res) => {
  res.json(store.getState());
});

app.post("/api/games", (req, res) => {
  const current = store.getState();
  const nextGame = normalizeGame(req.body || {});

  if (!nextGame.title) {
    res.status(400).json({ error: "Game title is required." });
    return;
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

  res.json(
    saveState({
      ...current,
      games,
    }),
  );
});

app.delete("/api/games/:gameId", (req, res) => {
  const current = store.getState();
  const gameId = req.params.gameId;

  res.json(
    saveState({
      ...current,
      games: current.games.filter((item) => item.id !== gameId),
      psnPresence:
        current.psnPresence && `psn-${current.psnPresence.titleId}` === gameId ? null : current.psnPresence,
    }),
  );
});

app.post("/api/settings", (req, res) => {
  const current = store.getState();
  const incoming = req.body || {};
  const nextState = saveState({
    ...current,
    settings: {
      ...current.settings,
      ...incoming,
      psn: {
        ...current.settings.psn,
        ...((incoming && incoming.psn) || {}),
      },
      polling: {
        ...current.settings.polling,
        ...((incoming && incoming.polling) || {}),
      },
    },
  });
  schedulePolling();
  res.json(nextState);
});

app.post("/api/psn/connect", async (req, res) => {
  try {
    const nextState = await psn.connectWithNpsso((req.body && req.body.npsso) || "");
    schedulePolling();
    res.json(nextState);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/psn/sync", async (_req, res) => {
  try {
    const result = await psn.syncLibrary();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/psn/detect", async (_req, res) => {
  try {
    const result = await psn.detectCurrentGame();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() });
});

app.listen(port, () => {
  schedulePolling();
  console.log(`PS4 Tracker Web listening on port ${port}`);
});
