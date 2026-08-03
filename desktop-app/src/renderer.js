const state = {
  data: null,
  selectedGameId: null,
  filter: "",
};

const elements = {
  gameList: document.getElementById("gameList"),
  gameForm: document.getElementById("gameForm"),
  settingsForm: document.getElementById("settingsForm"),
  searchInput: document.getElementById("searchInput"),
  newGameButton: document.getElementById("newGameButton"),
  connectPsnButton: document.getElementById("connectPsnButton"),
  syncPsnButton: document.getElementById("syncPsnButton"),
  detectGameButton: document.getElementById("detectGameButton"),
  syncDiscordButton: document.getElementById("syncDiscordButton"),
  deleteButton: document.getElementById("deleteButton"),
  resetButton: document.getElementById("resetButton"),
  activeTitle: document.getElementById("activeTitle"),
  activeMeta: document.getElementById("activeMeta"),
  toast: document.getElementById("toast"),
};

const gameFields = {
  id: document.getElementById("gameId"),
  titleId: document.getElementById("titleIdInput"),
  source: document.getElementById("sourceInput"),
  imageUrl: document.getElementById("imageUrlInput"),
  playCount: document.getElementById("playCountInput"),
  playDuration: document.getElementById("playDurationInput"),
  firstPlayedAt: document.getElementById("firstPlayedAtInput"),
  lastPlayedAt: document.getElementById("lastPlayedAtInput"),
  title: document.getElementById("titleInput"),
  platform: document.getElementById("platformInput"),
  status: document.getElementById("statusInput"),
  hoursPlayed: document.getElementById("hoursInput"),
  presenceState: document.getElementById("presenceStateInput"),
  notes: document.getElementById("notesInput"),
  largeImageKey: document.getElementById("largeImageKeyInput"),
  largeImageText: document.getElementById("largeImageTextInput"),
  smallImageKey: document.getElementById("smallImageKeyInput"),
  smallImageText: document.getElementById("smallImageTextInput"),
};

const settingFields = {
  onlineId: document.getElementById("onlineIdInput"),
  npsso: document.getElementById("npssoInput"),
  discordClientId: document.getElementById("discordClientIdInput"),
  defaultLargeImageKey: document.getElementById("defaultLargeImageKeyInput"),
  defaultLargeImageText: document.getElementById("defaultLargeImageTextInput"),
  defaultSmallImageKey: document.getElementById("defaultSmallImageKeyInput"),
  defaultSmallImageText: document.getElementById("defaultSmallImageTextInput"),
  discordAutoSync: document.getElementById("discordAutoSyncInput"),
  discordPollInterval: document.getElementById("discordPollIntervalInput"),
  lastSync: document.getElementById("lastSyncInput"),
  lastPresence: document.getElementById("lastPresenceInput"),
  lastDiscordSync: document.getElementById("lastDiscordSyncInput"),
};

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.style.color = isError ? "#ffb4b4" : "";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

function getGames() {
  if (!state.data) {
    return [];
  }

  const query = state.filter.trim().toLowerCase();
  if (!query) {
    return state.data.games;
  }

  return state.data.games.filter((game) => {
    return [game.title, game.platform, game.status, game.notes]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });
}

function ensureSelection() {
  const games = state.data?.games || [];
  if (!games.length) {
    state.selectedGameId = null;
    return;
  }

  const hasSelected = games.some((game) => game.id === state.selectedGameId);
  if (!hasSelected) {
    state.selectedGameId = games[0].id;
  }
}

function getSelectedGame() {
  return state.data?.games.find((game) => game.id === state.selectedGameId) || null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderGameList() {
  const games = getGames();
  elements.gameList.innerHTML = "";

  if (!games.length) {
    const empty = document.createElement("div");
    empty.className = "game-card";
    empty.innerHTML = "<h4>No matches yet</h4><p>Connect PSN or add your first PS4 game manually.</p>";
    elements.gameList.appendChild(empty);
    return;
  }

  for (const game of games) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `game-card ${game.id === state.selectedGameId ? "active" : ""}`;
    button.innerHTML = `
      <h4>${escapeHtml(game.title)}</h4>
      <p>${escapeHtml(game.platform || "PS4")} | ${escapeHtml(game.status || "Backlog")}</p>
      <p>Plays: ${Number(game.playCount || 0)} | Last played: ${escapeHtml(formatDate(game.lastPlayedAt))}</p>
    `;
    button.addEventListener("click", () => {
      state.selectedGameId = game.id;
      render();
    });
    elements.gameList.appendChild(button);
  }
}

function renderForms() {
  const game = getSelectedGame();

  for (const [key, element] of Object.entries(gameFields)) {
    if (game) {
      element.value = game[key] ?? "";
    } else if (key === "platform") {
      element.value = "PS4";
    } else if (key === "status") {
      element.value = "Backlog";
    } else if (key === "hoursPlayed") {
      element.value = "0";
    } else {
      element.value = "";
    }
  }

  const psn = state.data?.settings?.psn || {};
  const discord = state.data?.settings?.discord || {};
  settingFields.onlineId.value = psn.onlineId || "";
  settingFields.npsso.value = "";
  settingFields.discordClientId.value = discord.clientId || "";
  settingFields.defaultLargeImageKey.value = discord.largeImageKey || "playstation";
  settingFields.defaultLargeImageText.value = discord.largeImageText || "PlayStation";
  settingFields.defaultSmallImageKey.value = discord.smallImageKey || "";
  settingFields.defaultSmallImageText.value = discord.smallImageText || "On PS4";
  settingFields.discordAutoSync.value = String(discord.autoSync !== false);
  settingFields.discordPollInterval.value = Number(discord.pollIntervalMs || 15000);
  settingFields.lastSync.value = formatDate(psn.lastSyncAt);
  settingFields.lastPresence.value = formatDate(psn.lastPresenceCheckAt);
  settingFields.lastDiscordSync.value = formatDate(discord.lastRichPresenceAt);
}

function renderHero() {
  const presence = state.data?.psnPresence;

  if (!presence || !presence.titleName) {
    elements.activeTitle.textContent = "No PSN activity detected yet";
    elements.activeMeta.textContent = "Use Detect Current Game after you connect your PlayStation account.";
    return;
  }

  elements.activeTitle.textContent = `Now playing: ${presence.titleName}`;
  elements.activeMeta.textContent = `${presence.platform} | ${presence.onlineStatus} | Checked ${new Date(
    presence.checkedAt,
  ).toLocaleString()}`;
}

function render() {
  ensureSelection();
  renderGameList();
  renderForms();
  renderHero();
}

function readGameForm() {
  return {
    id: gameFields.id.value || undefined,
    titleId: gameFields.titleId.value,
    source: gameFields.source.value,
    imageUrl: gameFields.imageUrl.value,
    playCount: gameFields.playCount.value,
    playDuration: gameFields.playDuration.value,
    firstPlayedAt: gameFields.firstPlayedAt.value,
    lastPlayedAt: gameFields.lastPlayedAt.value,
    title: gameFields.title.value,
    platform: gameFields.platform.value,
    status: gameFields.status.value,
    hoursPlayed: gameFields.hoursPlayed.value,
    presenceState: gameFields.presenceState.value,
    notes: gameFields.notes.value,
    largeImageKey: gameFields.largeImageKey.value,
    largeImageText: gameFields.largeImageText.value,
    smallImageKey: gameFields.smallImageKey.value,
    smallImageText: gameFields.smallImageText.value,
  };
}

function readSettingsForm() {
  return {
    psn: {
      onlineId: settingFields.onlineId.value.trim(),
    },
    discord: {
      clientId: settingFields.discordClientId.value.trim(),
      largeImageKey: settingFields.defaultLargeImageKey.value.trim(),
      largeImageText: settingFields.defaultLargeImageText.value.trim(),
      smallImageKey: settingFields.defaultSmallImageKey.value.trim(),
      smallImageText: settingFields.defaultSmallImageText.value.trim(),
      autoSync: settingFields.discordAutoSync.value === "true",
      pollIntervalMs: Number(settingFields.discordPollInterval.value || 15000),
    },
  };
}

function clearGameForm() {
  state.selectedGameId = null;
  for (const [key, element] of Object.entries(gameFields)) {
    if (key === "platform") {
      element.value = "PS4";
    } else if (key === "status") {
      element.value = "Backlog";
    } else if (key === "hoursPlayed") {
      element.value = "0";
    } else {
      element.value = "";
    }
  }
}

async function refresh() {
  state.data = await window.trackerApi.getState();
  render();
}

window.trackerApi.onStateUpdated((nextState) => {
  state.data = nextState;
  render();
});

elements.gameForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const result = await window.trackerApi.saveGame(readGameForm());
    state.data = result;
    if (!state.selectedGameId) {
      state.selectedGameId = result.games[0]?.id || null;
    }
    render();
    showToast("Game saved.");
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    state.data = await window.trackerApi.saveSettings(readSettingsForm());
    render();
    showToast("Settings saved.");
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.searchInput.addEventListener("input", (event) => {
  state.filter = event.target.value;
  renderGameList();
});

elements.newGameButton.addEventListener("click", () => {
  clearGameForm();
  showToast("Ready for a new game entry.");
});

elements.resetButton.addEventListener("click", () => {
  clearGameForm();
  showToast("Form cleared.");
});

elements.deleteButton.addEventListener("click", async () => {
  const selectedGame = getSelectedGame();
  if (!selectedGame) {
    showToast("Pick a game first.", true);
    return;
  }

  try {
    state.data = await window.trackerApi.deleteGame(selectedGame.id);
    state.selectedGameId = state.data.games[0]?.id || null;
    render();
    showToast("Game removed.");
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.connectPsnButton.addEventListener("click", async () => {
  try {
    state.data = await window.trackerApi.connectPsn(settingFields.npsso.value.trim());
    settingFields.npsso.value = "";
    render();
    showToast("PlayStation account connected.");
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.syncPsnButton.addEventListener("click", async () => {
  try {
    const result = await window.trackerApi.syncPsnLibrary();
    state.data = result.state;
    render();
    showToast(`Imported ${result.importedCount} PSN titles.`);
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.detectGameButton.addEventListener("click", async () => {
  try {
    const result = await window.trackerApi.detectCurrentPsnGame();
    state.data = result.state;
    render();
    showToast(result.currentGame.titleName ? `Detected ${result.currentGame.titleName}.` : "No active PSN game found.");
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.syncDiscordButton.addEventListener("click", async () => {
  try {
    state.data = await window.trackerApi.syncDiscordPresence();
    render();
    showToast("Discord Rich Presence synced.");
  } catch (error) {
    showToast(error.message, true);
  }
});

refresh().catch((error) => {
  showToast(error.message, true);
});
