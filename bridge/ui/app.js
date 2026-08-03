const fields = {
  siteUrl: document.getElementById("siteUrl"),
  siteUsername: document.getElementById("siteUsername"),
  sitePassword: document.getElementById("sitePassword"),
  clientId: document.getElementById("clientId"),
  pollIntervalMs: document.getElementById("pollIntervalMs"),
  autoOpenUi: document.getElementById("autoOpenUi"),
  largeImageKey: document.getElementById("largeImageKey"),
  largeImageText: document.getElementById("largeImageText"),
  smallImageKey: document.getElementById("smallImageKey"),
  smallImageText: document.getElementById("smallImageText"),
};

const statusEls = {
  rpcStatus: document.getElementById("rpcStatus"),
  trackerStatus: document.getElementById("trackerStatus"),
  activeTitle: document.getElementById("activeTitle"),
  activePlatform: document.getElementById("activePlatform"),
  lastSyncAt: document.getElementById("lastSyncAt"),
  lastError: document.getElementById("lastError"),
  uiUrl: document.getElementById("uiUrl"),
  sitePasswordHint: document.getElementById("sitePasswordHint"),
  toast: document.getElementById("toast"),
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Request failed.");
  }

  return body;
}

function showToast(message, isError = false) {
  statusEls.toast.textContent = message;
  statusEls.toast.style.color = isError ? "#ffb4b4" : "";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

function render(payload) {
  const { config, status } = payload;

  fields.siteUrl.value = config.siteUrl || "";
  fields.siteUsername.value = config.siteUsername || "admin";
  fields.sitePassword.value = "";
  fields.clientId.value = config.clientId || "";
  fields.pollIntervalMs.value = Number(config.pollIntervalMs || 15000);
  fields.autoOpenUi.value = String(Boolean(config.autoOpenUi));
  fields.largeImageKey.value = config.largeImageKey || "";
  fields.largeImageText.value = config.largeImageText || "";
  fields.smallImageKey.value = config.smallImageKey || "";
  fields.smallImageText.value = config.smallImageText || "";
  statusEls.sitePasswordHint.textContent = config.hasSitePassword
    ? "A site password is already saved. Leave the box blank to keep it."
    : "If your Railway site has a password, paste it once here and the bridge will save it.";

  statusEls.rpcStatus.textContent = status.rpcConnected ? "Connected" : "Waiting";
  statusEls.trackerStatus.textContent = status.trackerReachable ? "Reachable" : "Not reached yet";
  statusEls.activeTitle.textContent = status.activeTitle || "None";
  statusEls.activePlatform.textContent = status.activePlatform || "None";
  statusEls.lastSyncAt.textContent = formatDate(status.lastSyncAt);
  statusEls.lastError.textContent = status.lastError || "None";
  statusEls.uiUrl.textContent = status.uiUrl || window.location.href;
}

function readForm() {
  return {
    siteUrl: fields.siteUrl.value.trim(),
    siteUsername: fields.siteUsername.value.trim(),
    sitePassword: fields.sitePassword.value,
    clientId: fields.clientId.value.trim(),
    pollIntervalMs: Number(fields.pollIntervalMs.value || 15000),
    autoOpenUi: fields.autoOpenUi.value === "true",
    largeImageKey: fields.largeImageKey.value.trim(),
    largeImageText: fields.largeImageText.value.trim(),
    smallImageKey: fields.smallImageKey.value.trim(),
    smallImageText: fields.smallImageText.value.trim(),
  };
}

async function refresh() {
  const payload = await request("/api/bridge/state");
  render(payload);
}

document.getElementById("configForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await request("/api/bridge/config", {
      method: "POST",
      body: JSON.stringify(readForm()),
    });
    render(payload);
    showToast("Setup saved. In most cases you're done now.");
  } catch (error) {
    showToast(error.message, true);
  }
});

document.getElementById("testButton").addEventListener("click", async () => {
  try {
    const payload = await request("/api/bridge/test", {
      method: "POST",
      body: "{}",
    });
    render({
      config: {
        ...readForm(),
        sitePassword: fields.sitePassword.value ? "stored" : "",
      },
      status: payload.status,
    });
    showToast("Bridge test passed.");
  } catch (error) {
    showToast(error.message, true);
  }
});

refresh().catch((error) => {
  showToast(error.message, true);
});
