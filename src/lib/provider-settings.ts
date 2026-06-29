export type BrowserProviderSettings = {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
};

export const DEFAULT_PROVIDER_SETTINGS: BrowserProviderSettings = {
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  chatModel: "deepseek-chat",
};

const STORAGE_KEY = "evalsupport-ai.provider-settings.v1";
const SETTINGS_EVENT = "evalsupport-ai-provider-settings";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function emitSettingsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }
}

export function loadProviderSettings(): BrowserProviderSettings {
  if (!canUseStorage()) {
    return DEFAULT_PROVIDER_SETTINGS;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PROVIDER_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BrowserProviderSettings>;
    return {
      baseUrl: parsed.baseUrl || DEFAULT_PROVIDER_SETTINGS.baseUrl,
      apiKey: parsed.apiKey || "",
      chatModel: parsed.chatModel || DEFAULT_PROVIDER_SETTINGS.chatModel,
    };
  } catch {
    return DEFAULT_PROVIDER_SETTINGS;
  }
}

export function saveProviderSettings(settings: BrowserProviderSettings) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      baseUrl: settings.baseUrl.trim(),
      apiKey: settings.apiKey,
      chatModel: settings.chatModel.trim(),
    }),
  );
  emitSettingsChanged();
}

export function clearProviderSettings() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  emitSettingsChanged();
}

export function hasCompleteProviderSettings(settings: BrowserProviderSettings) {
  return Boolean(
    settings.baseUrl.trim() && settings.apiKey.trim() && settings.chatModel.trim(),
  );
}

export function toProviderConfig(settings: BrowserProviderSettings) {
  if (!hasCompleteProviderSettings(settings)) {
    return undefined;
  }

  return {
    baseUrl: settings.baseUrl.trim(),
    apiKey: settings.apiKey,
    chatModel: settings.chatModel.trim(),
  };
}
