const { Client } = require("@xhayper/discord-rpc");

class DiscordPresenceManager {
  constructor() {
    this.client = null;
    this.clientId = "";
    this.connected = false;
  }

  async ensureClient(clientId) {
    if (!clientId) {
      throw new Error("Add your Discord application Client ID to enable Rich Presence.");
    }

    if (this.client && this.clientId === clientId && this.connected) {
      return this.client;
    }

    await this.disconnect();

    this.clientId = clientId;
    this.client = new Client({ clientId });

    this.client.on("ready", () => {
      this.connected = true;
    });

    this.client.on("disconnected", () => {
      this.connected = false;
    });

    await this.client.login();
    if (!this.connected) {
      this.connected = true;
    }

    return this.client;
  }

  buildActivity(settings, presence) {
    if (!presence || !presence.titleName) {
      return null;
    }

    const startedAt = presence.startedAt || presence.checkedAt;
    const startTimestamp = startedAt ? new Date(startedAt) : new Date();
    const activity = {
      name: presence.titleName,
      details: presence.titleName,
      state: "On PS4",
      type: 0,
      startTimestamp,
      buttons: [
        {
          label: "PlayStation",
          url: "https://www.playstation.com/",
        },
      ],
    };

    if (settings.largeImageKey) {
      activity.largeImageKey = settings.largeImageKey;
    }

    if (settings.largeImageText) {
      activity.largeImageText = settings.largeImageText;
    }

    if (settings.smallImageKey) {
      activity.smallImageKey = settings.smallImageKey;
      if (settings.smallImageText) {
        activity.smallImageText = settings.smallImageText;
      }
    }

    return activity;
  }

  async syncPresence(settings, presence) {
    if (!settings.autoSync) {
      await this.clearPresence();
      return false;
    }

    const activity = this.buildActivity(settings, presence);
    if (!activity) {
      await this.clearPresence();
      return false;
    }

    const client = await this.ensureClient(settings.clientId);
    await client.user?.setActivity(activity);
    return true;
  }

  async clearPresence() {
    if (!this.client || !this.connected) {
      return;
    }

    await this.client.user?.clearActivity();
  }

  async disconnect() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.destroy();
    } catch (_error) {
      // noop
    } finally {
      this.client = null;
      this.connected = false;
    }
  }
}

module.exports = {
  DiscordPresenceManager,
};
