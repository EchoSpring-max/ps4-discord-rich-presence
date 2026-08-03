const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trackerApi", {
  getState: () => ipcRenderer.invoke("tracker:get-state"),
  saveGame: (game) => ipcRenderer.invoke("tracker:save-game", game),
  deleteGame: (gameId) => ipcRenderer.invoke("tracker:delete-game", gameId),
  saveSettings: (settings) => ipcRenderer.invoke("tracker:save-settings", settings),
  connectPsn: (npsso) => ipcRenderer.invoke("tracker:connect-psn", npsso),
  syncPsnLibrary: () => ipcRenderer.invoke("tracker:sync-psn-library"),
  detectCurrentPsnGame: () => ipcRenderer.invoke("tracker:detect-current-psn-game"),
  syncDiscordPresence: () => ipcRenderer.invoke("tracker:sync-discord-presence"),
  onStateUpdated: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("tracker:state-updated", listener);

    return () => {
      ipcRenderer.removeListener("tracker:state-updated", listener);
    };
  },
});
