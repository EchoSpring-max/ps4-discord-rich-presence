const path = require("path");
const fs = require("fs");

const envCandidates = [
  path.join(process.cwd(), ".env"),
  path.join(path.dirname(process.execPath), ".env"),
  path.join(__dirname, ".env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    break;
  }
}
const { Client } = require("@xhayper/discord-rpc");

const config = {
  siteUrl: (process.env.SITE_URL || "").replace(/\/+$/, ""),
  clientId: (process.env.DISCORD_CLIENT_ID || "").trim(),
  pollIntervalMs: Math.max(5000, Number(process.env.POLL_INTERVAL_MS || 15000)),
  largeImageKey: (process.env.LARGE_IMAGE_KEY || "").trim(),
  largeImageText: (process.env.LARGE_IMAGE_TEXT || "PS4 Tracker").trim(),
  smallImageKey: (process.env.SMALL_IMAGE_KEY || "").trim(),
  smallImageText: (process.env.SMALL_IMAGE_TEXT || "On PS4").trim(),
};

if (!config.siteUrl) {
  throw new Error("Missing SITE_URL in .env");
}

if (!config.clientId) {
  throw new Error("Missing DISCORD_CLIENT_ID in .env");
}

const rpc = new Client({ clientId: config.clientId });
let connected = false;
let lastPresenceKey = "";

function log(message) {
  console.log(`[bridge] ${message}`);
}

async function ensureConnected() {
  if (connected) {
    return;
  }

  rpc.on("ready", () => {
    connected = true;
    log("Connected to Discord RPC.");
  });

  rpc.on("disconnected", () => {
    connected = false;
    log("Disconnected from Discord RPC.");
  });

  await rpc.login();
}

async function fetchState() {
  const response = await fetch(`${config.siteUrl}/api/state`);
  if (!response.ok) {
    throw new Error(`Tracker site returned ${response.status}.`);
  }

  return response.json();
}

function buildPresence(state) {
  const presence = state.psnPresence;
  if (!presence || !presence.titleName) {
    return null;
  }

  const checkedAt = presence.checkedAt ? new Date(presence.checkedAt) : new Date();
  const activity = {
    details: `Playing ${presence.titleName}`,
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

  if (config.largeImageKey) {
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
  const state = await fetchState();
  const activity = buildPresence(state);
  const presenceKey = JSON.stringify(activity || null);

  if (presenceKey === lastPresenceKey) {
    return;
  }

  if (!activity) {
    await rpc.user?.clearActivity();
    lastPresenceKey = presenceKey;
    log("Cleared Discord Rich Presence.");
    return;
  }

  await rpc.user?.setActivity(activity);
  lastPresenceKey = presenceKey;
  log(`Updated Rich Presence: ${state.psnPresence.titleName}`);
}

async function main() {
  await ensureConnected();

  setInterval(async () => {
    try {
      await syncPresence();
    } catch (error) {
      log(`Sync failed: ${error.message}`);
    }
  }, config.pollIntervalMs);

  try {
    await syncPresence();
  } catch (error) {
    log(`Initial sync failed: ${error.message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
