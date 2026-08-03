const {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getBasicPresence,
  getProfileFromAccountId,
  getUserPlayedGames,
} = require("psn-api");

function parseJwtPayload(token) {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Could not read the PlayStation token payload.");
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function toExpiryIso(secondsFromNow) {
  return new Date(Date.now() + Math.max(secondsFromNow - 60, 0) * 1000).toISOString();
}

function isExpired(isoString) {
  if (!isoString) {
    return true;
  }

  return Date.now() >= new Date(isoString).getTime();
}

class PsnManager {
  constructor({ getState, saveState }) {
    this.getState = getState;
    this.saveState = saveState;
  }

  buildAuthState(tokens, accountId, onlineId, previous = {}) {
    return {
      npsso: previous.npsso || "",
      accountId: accountId || previous.accountId || "",
      onlineId: onlineId || previous.onlineId || "",
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: toExpiryIso(tokens.expiresIn),
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: toExpiryIso(tokens.refreshTokenExpiresIn),
      connectedAt: previous.connectedAt || new Date().toISOString(),
      lastSyncAt: previous.lastSyncAt || "",
      lastPresenceCheckAt: previous.lastPresenceCheckAt || "",
    };
  }

  async connectWithNpsso(npsso) {
    if (!npsso || npsso.trim().length < 20) {
      throw new Error("Paste a valid NPSSO token from Sony before connecting.");
    }

    const accessCode = await exchangeNpssoForAccessCode(npsso.trim());
    const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
    const payload = parseJwtPayload(tokens.idToken);
    const accountId = payload.sub || payload.accountId || "";
    const profile = accountId
      ? await getProfileFromAccountId({ accessToken: tokens.accessToken }, accountId)
      : null;
    const current = this.getState();

    return this.saveState({
      ...current,
      settings: {
        ...current.settings,
        psn: {
          ...this.buildAuthState(tokens, accountId, profile?.onlineId || "", current.settings.psn),
          npsso: npsso.trim(),
        },
      },
    });
  }

  async exchangeStoredNpsso(psn, current) {
    if (!psn.npsso) {
      throw new Error("Your PlayStation session expired. Reconnect with a fresh NPSSO token.");
    }

    const accessCode = await exchangeNpssoForAccessCode(psn.npsso);
    const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
    const payload = parseJwtPayload(tokens.idToken);
    const accountId = payload.sub || payload.accountId || psn.accountId || "";
    const nextState = this.saveState({
      ...current,
      settings: {
        ...current.settings,
        psn: {
          ...this.buildAuthState(tokens, accountId, psn.onlineId, psn),
          npsso: psn.npsso,
        },
      },
    });

    return {
      accessToken: nextState.settings.psn.accessToken,
      state: nextState,
    };
  }

  async ensureAuthorization() {
    const current = this.getState();
    const psn = current.settings.psn || {};

    if (!psn.accessToken && !psn.refreshToken) {
      throw new Error("Connect your PlayStation account first using an NPSSO token.");
    }

    if (!isExpired(psn.accessTokenExpiresAt)) {
      return {
        accessToken: psn.accessToken,
        state: current,
      };
    }

    if (!psn.refreshToken || isExpired(psn.refreshTokenExpiresAt)) {
      return this.exchangeStoredNpsso(psn, current);
    }

    try {
      const tokens = await exchangeRefreshTokenForAuthTokens(psn.refreshToken);
      const payload = parseJwtPayload(tokens.idToken);
      const accountId = payload.sub || payload.accountId || psn.accountId || "";
      const nextState = this.saveState({
        ...current,
        settings: {
          ...current.settings,
          psn: {
            ...this.buildAuthState(tokens, accountId, psn.onlineId, psn),
            npsso: psn.npsso || "",
          },
        },
      });

      return {
        accessToken: nextState.settings.psn.accessToken,
        state: nextState,
      };
    } catch (error) {
      if (!psn.npsso) {
        throw error;
      }

      return this.exchangeStoredNpsso(psn, current);
    }
  }

  upsertGames(existingGames, incomingGames) {
    const games = [...existingGames];

    for (const incoming of incomingGames) {
      const existingIndex = games.findIndex((game) => {
        return game.titleId === incoming.titleId || game.id === incoming.id || game.title === incoming.title;
      });

      if (existingIndex >= 0) {
        games[existingIndex] = {
          ...games[existingIndex],
          ...incoming,
          id: games[existingIndex].id || incoming.id,
        };
      } else {
        games.push(incoming);
      }
    }

    return games.sort((a, b) => {
      const aTime = new Date(a.lastPlayedAt || 0).getTime();
      const bTime = new Date(b.lastPlayedAt || 0).getTime();
      return bTime - aTime;
    });
  }

  async syncLibrary() {
    const { accessToken, state } = await this.ensureAuthorization();
    const playedGames = await getUserPlayedGames({ accessToken }, "me", {
      limit: 200,
      categories: "ps4_game",
    });

    const syncedGames = playedGames.titles.map((title) => ({
      id: `psn-${title.titleId}`,
      titleId: title.titleId,
      title: title.localizedName || title.name,
      platform: "PS4",
      status: "Backlog",
      hoursPlayed: 0,
      presenceState: "",
      notes: "",
      largeImageKey: "",
      largeImageText: "",
      smallImageKey: "",
      smallImageText: "",
      imageUrl: title.localizedImageUrl || title.imageUrl || "",
      playCount: title.playCount || 0,
      playDuration: title.playDuration || "",
      source: "psn",
      firstPlayedAt: title.firstPlayedDateTime || null,
      lastPlayedAt: title.lastPlayedDateTime || null,
    }));

    const nextState = this.saveState({
      ...state,
      games: this.upsertGames(state.games, syncedGames),
      settings: {
        ...state.settings,
        psn: {
          ...state.settings.psn,
          lastSyncAt: new Date().toISOString(),
        },
      },
    });

    return {
      state: nextState,
      importedCount: syncedGames.length,
    };
  }

  async detectCurrentGame() {
    const { accessToken, state } = await this.ensureAuthorization();
    const accountId = state.settings.psn.accountId;

    if (!accountId) {
      throw new Error("This PlayStation session is missing an account ID. Reconnect and try again.");
    }

    const response = await getBasicPresence({ accessToken }, accountId);
    const currentGame =
      response.basicPresence.gameTitleInfoList.find((game) => String(game.format || "").toLowerCase() === "ps4") ||
      response.basicPresence.gameTitleInfoList[0] ||
      null;
    const checkedAt = new Date().toISOString();

    let games = state.games;
    if (currentGame) {
      games = this.upsertGames(state.games, [
        {
          id: `psn-${currentGame.npTitleId}`,
          titleId: currentGame.npTitleId,
          title: currentGame.titleName,
          platform: String(currentGame.format || "PS4").toUpperCase(),
          status: "Playing",
          hoursPlayed: 0,
          presenceState: "Auto-detected from PSN",
          notes: "",
          largeImageKey: "",
          largeImageText: "",
          smallImageKey: "",
          smallImageText: "",
          imageUrl: currentGame.npTitleIconUrl || currentGame.conceptIconUrl || "",
          playCount: 0,
          playDuration: "",
          source: "psn",
          firstPlayedAt: null,
          lastPlayedAt: checkedAt,
        },
      ]);
    }

    const nextState = this.saveState({
      ...state,
      games,
      psnPresence: {
        availability: response.basicPresence.availability,
        onlineStatus:
          response.basicPresence.primaryPlatformInfo?.onlineStatus || response.basicPresence.onlineStatus || "offline",
        platform:
          currentGame?.format ||
          response.basicPresence.primaryPlatformInfo?.platform ||
          response.basicPresence.platform ||
          "PS4",
        titleId: currentGame?.npTitleId || "",
        titleName: currentGame?.titleName || "",
        imageUrl: currentGame?.npTitleIconUrl || currentGame?.conceptIconUrl || "",
        checkedAt,
      },
      settings: {
        ...state.settings,
        psn: {
          ...state.settings.psn,
          lastPresenceCheckAt: checkedAt,
        },
      },
    });

    return {
      state: nextState,
      currentGame: nextState.psnPresence,
    };
  }
}

module.exports = {
  PsnManager,
};
