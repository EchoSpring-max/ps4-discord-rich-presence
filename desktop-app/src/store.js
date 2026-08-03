const fs = require("fs");
const path = require("path");

const defaultState = {
  settings: {
    psn: {
      npsso: "",
      accountId: "",
      onlineId: "",
      accessToken: "",
      accessTokenExpiresAt: "",
      refreshToken: "",
      refreshTokenExpiresAt: "",
      connectedAt: "",
      lastSyncAt: "",
      lastPresenceCheckAt: "",
    },
    discord: {
      clientId: "",
      largeImageKey: "playstation",
      largeImageText: "PlayStation",
      smallImageKey: "",
      smallImageText: "On PS4",
      autoSync: true,
      pollIntervalMs: 15000,
      lastRichPresenceAt: "",
    },
  },
  games: [],
  psnPresence: null,
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = cloneDefaultState();
  }

  load() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.save();
      return this.state;
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw);

      this.state = {
        ...cloneDefaultState(),
        ...parsed,
        settings: {
          ...cloneDefaultState().settings,
          ...(parsed.settings || {}),
          psn: {
            ...cloneDefaultState().settings.psn,
            ...((parsed.settings && parsed.settings.psn) || {}),
          },
          discord: {
            ...cloneDefaultState().settings.discord,
            ...((parsed.settings && parsed.settings.discord) || {}),
          },
        },
        games: Array.isArray(parsed.games) ? parsed.games : [],
        psnPresence: parsed.psnPresence || null,
      };
    } catch (error) {
      console.warn("Failed to read store, falling back to defaults.", error);
      this.state = cloneDefaultState();
      this.save();
    }

    return this.state;
  }

  getState() {
    return this.state;
  }

  setState(nextState) {
    this.state = nextState;
    this.save();
    return this.state;
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}

module.exports = {
  Store,
  defaultState,
};
