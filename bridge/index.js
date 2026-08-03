const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const express = require("express");
const { Client } = require("@xhayper/discord-rpc");

const APP_PORT = Number(process.env.BRIDGE_UI_PORT || 3487);
const CONFIG_CANDIDATES = [
  path.join(process.cwd(), "config.json"),
  path.join(path.dirname(process.execPath), "config.json"),
  path.join(__dirname, "config.json"),
];

const DEFAULT_CONFIG = {
  siteUrl: "https://ps4discord.up.railway.app",
  clientId: "",
  pollIntervalMs: 15000,
  siteUsername: "admin",
  sitePassword: "",
  largeImageKey: "",
  largeImageText: "PS4 Tracker",
  smallImageKey: "",
  smallImageText: "On PS4",
  autoOpenUi: true,
};

const runtime = {
  config: null,
  rpc: null,
  rpcReady: false,
  pollTimer: null,
  lastPresenceKey: "",
  status: {
    bridgeStartedAt: new Date().toISOString(),
    lastSyncAt: "",
    lastError: "",
    rpcConnected: false,
    trackerReachable: false,
    activeTitle: "",
    activePlatform: "",
    uiUrl: `http://127.0.0.1:${APP_PORT}`,
  },
};

function log(message) {
  console.log(`[bridge] ${message}`);
}

function resolveConfigPath() {
  for (const candidate of CONFIG_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return CONFIG_CANDIDATES[1];
}

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function loadLegacyEnv() {
  const envCandidates = [
    path.join(process.cwd(), ".env"),
    path.join(path.dirname(process.execPath), ".env"),
    path.join(__dirname, ".env"),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      require("dotenv").config({ path: envPath });
      return {
        siteUrl: process.env.SITE_URL || "",
        clientId: process.env.DISCORD_CLIENT_ID || "",
        pollIntervalMs: process.env.POLL_INTERVAL_MS || "",
        siteUsername: process.env.SITE_USERNAME || "",
        sitePassword: process.env.SITE_PASSWORD || "",
        largeImageKey: process.env.LARGE_IMAGE_KEY || "",
        largeImageText: process.env.LARGE_IMAGE_TEXT || "",
        smallImageKey: process.env.SMALL_IMAGE_KEY || "",
        smallImageText: process.env.SMALL_IMAGE_TEXT || "",
      };
    }
  }

  return null;
}

function loadConfig() {
  const base = cloneDefaultConfig();
  const filePath = resolveConfigPath();

  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return {
        filePath,
        config: {
          ...base,
          ...parsed,
          pollIntervalMs: Math.max(5000, Number(parsed.pollIntervalMs || base.pollIntervalMs)),
        },
      };
    } catch (error) {
      log(`Failed to read config.json, falling back to defaults: ${error.message}`);
    }
  }

  const envConfig = loadLegacyEnv();
  if (envConfig) {
    return {
      filePath,
      config: {
        ...base,
        ...envConfig,
        siteUrl: (envConfig.siteUrl || base.siteUrl).replace(/\/+$/, ""),
        clientId: (envConfig.clientId || "").trim(),
        pollIntervalMs: Math.max(5000, Number(envConfig.pollIntervalMs || base.pollIntervalMs)),
      },
    };
  }

  return { filePath, config: base };
}

function saveConfig(nextConfig) {
  const filePath = resolveConfigPath();
  const normalized = {
    ...cloneDefaultConfig(),
    ...nextConfig,
    siteUrl: String(nextConfig.siteUrl || cloneDefaultConfig().siteUrl).replace(/\/+$/, ""),
    clientId: String(nextConfig.clientId || "").trim(),
    siteUsername: String(nextConfig.siteUsername || "admin").trim() || "admin",
    sitePassword: String(nextConfig.sitePassword || ""),
    pollIntervalMs: Math.max(5000, Number(nextConfig.pollIntervalMs || 15000)),
    largeImageKey: String(nextConfig.largeImageKey || "").trim(),
    largeImageText: String(nextConfig.largeImageText || "PS4 Tracker").trim() || "PS4 Tracker",
    smallImageKey: String(nextConfig.smallImageKey || "").trim(),
    smallImageText: String(nextConfig.smallImageText || "On PS4").trim() || "On PS4",
    autoOpenUi: Boolean(nextConfig.autoOpenUi),
  };

  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
  runtime.config = normalized;
  return normalized;
}

function getSafeConfig() {
  const config = runtime.config || cloneDefaultConfig();
  return {
    ...config,
    sitePassword: config.sitePassword ? "stored" : "",
    hasSitePassword: Boolean(config.sitePassword),
  };
}

function setStatus(patch) {
  runtime.status = {
    ...runtime.status,
    ...patch,
  };
}

async function disconnectRpc() {
  if (!runtime.rpc) {
    return;
  }

  try {
    await runtime.rpc.user?.clearActivity();
    await runtime.rpc.destroy();
  } catch (_error) {
    // noop
  } finally {
    runtime.rpc = null;
    runtime.rpcReady = false;
    setStatus({ rpcConnected: false });
  }
}

async function ensureRpc() {
  const config = runtime.config;
  if (!config.clientId) {
    throw new Error("Add your Discord application Client ID in the bridge setup page.");
  }

  if (runtime.rpc && runtime.rpcReady) {
    return runtime.rpc;
  }

  await disconnectRpc();

  const rpc = new Client({ clientId: config.clientId });
  rpc.on("ready", () => {
    runtime.rpcReady = true;
    setStatus({ rpcConnected: true, lastError: "" });
    log("Connected to Discord RPC.");
  });

  rpc.on("disconnected", () => {
    runtime.rpcReady = false;
    setStatus({ rpcConnected: false });
    log("Disconnected from Discord RPC.");
  });

  runtime.rpc = rpc;
  await rpc.login();

  if (!runtime.rpcReady) {
    runtime.rpcReady = true;
    setStatus({ rpcConnected: true });
  }

  return rpc;
}

async function fetchState() {
  const config = runtime.config;
  if (!config.siteUrl) {
    throw new Error("Add your tracker site URL in the bridge setup page.");
  }

  const headers = {};
  if (config.sitePassword) {
    headers.Authorization = `Basic ${Buffer.from(`${config.siteUsername}:${config.sitePassword}`).toString("base64")}`;
  }

  const response = await fetch(`${config.siteUrl}/api/state`, { headers });
  if (!response.ok) {
    throw new Error(`Tracker site returned ${response.status}.`);
  }

  setStatus({ trackerReachable: true });
  return response.json();
}

function buildPresence(state) {
  const config = runtime.config;
  const presence = state.psnPresence;
  if (!presence || !presence.titleName) {
    return null;
  }

  const checkedAt = presence.checkedAt ? new Date(presence.checkedAt) : new Date();
  const activity = {
    name: presence.titleName,
    details: presence.titleName,
    state: `${presence.platform || "PS4"} via PSN Tracker`,
    type: 0,
    timestamps: {
      start: checkedAt,
    },
    buttons: [
      {
        label: "PS4 Tracker",
        url: config.siteUrl,
      },
    ],
  };

  if (presence.imageUrl) {
    activity.largeImageUrl = presence.imageUrl;
    activity.largeImageText = config.largeImageText || presence.titleName;
  } else if (config.largeImageKey) {
    activity.largeImageKey = config.largeImageKey;
    activity.largeImageText = config.largeImageText || presence.titleName;
  }

  if (config.smallImageKey) {
    activity.smallImageKey = config.smallImageKey;
    activity.smallImageText = config.smallImageText || presence.platform || "PS4";
  }

  return activity;
}

async function syncPresence() {
  const rpc = await ensureRpc();
  const state = await fetchState();
  const activity = buildPresence(state);
  const presenceKey = JSON.stringify(activity || null);

  setStatus({
    lastSyncAt: new Date().toISOString(),
    lastError: "",
    activeTitle: state.psnPresence?.titleName || "",
    activePlatform: state.psnPresence?.platform || "",
  });

  if (presenceKey === runtime.lastPresenceKey) {
    return;
  }

  if (!activity) {
    await rpc.user?.clearActivity();
    runtime.lastPresenceKey = presenceKey;
    log("Cleared Discord Rich Presence.");
    return;
  }

  await rpc.user?.setActivity(activity);
  runtime.lastPresenceKey = presenceKey;
  log(`Updated Rich Presence: ${state.psnPresence.titleName}`);
}

function restartPolling() {
  if (runtime.pollTimer) {
    clearInterval(runtime.pollTimer);
    runtime.pollTimer = null;
  }

  runtime.lastPresenceKey = "";

  runtime.pollTimer = setInterval(async () => {
    try {
      await syncPresence();
    } catch (error) {
      setStatus({
        lastSyncAt: new Date().toISOString(),
        lastError: error.message,
        trackerReachable: false,
      });
      log(`Sync failed: ${error.message}`);
    }
  }, runtime.config.pollIntervalMs);
}

function openUi(url) {
  const platform = process.platform;
  const command =
    platform === "win32"
      ? `start "" "${url}"`
      : platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      log(`Could not auto-open setup page. Open ${url} manually.`);
    }
  });
}

function installRoutes(app) {
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(path.join(__dirname, "ui")));

  app.get("/api/bridge/state", (_req, res) => {
    res.json({
      config: getSafeConfig(),
      status: runtime.status,
    });
  });

  app.post("/api/bridge/config", async (req, res) => {
    try {
      const nextConfig = saveConfig(req.body || {});
      await disconnectRpc();
      restartPolling();
      try {
        await syncPresence();
      } catch (error) {
        setStatus({
          lastError: error.message,
          trackerReachable: false,
        });
      }

      res.json({
        ok: true,
        config: {
          ...getSafeConfig(),
          siteUrl: nextConfig.siteUrl,
        },
        status: runtime.status,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bridge/test", async (_req, res) => {
    try {
      await syncPresence();
      res.json({
        ok: true,
        status: runtime.status,
      });
    } catch (error) {
      setStatus({
        lastError: error.message,
        trackerReachable: false,
      });
      res.status(400).json({ error: error.message, status: runtime.status });
    }
  });
}

async function main() {
  const loaded = loadConfig();
  runtime.config = loaded.config;

  restartPolling();

  const app = express();
  installRoutes(app);

  app.listen(APP_PORT, async () => {
    const url = `http://127.0.0.1:${APP_PORT}`;
    log(`Bridge setup UI running at ${url}`);

    if (runtime.config.autoOpenUi) {
      openUi(url);
    }

    try {
      await syncPresence();
    } catch (error) {
      setStatus({
        lastError: error.message,
        trackerReachable: false,
      });
      log(`Initial sync failed: ${error.message}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
