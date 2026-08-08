import { invoke } from '@tauri-apps/api/core';

export interface BrowserSettings {
  homepage: string;
  newTabPage: string;
  searchEngine: string;
  geminiApiKey: string;
  theme: 'nebula' | 'matrix' | 'void';
  particleDensity: number;
  reducedMotion: boolean;
  hardwareAcceleration: boolean;
  blockTrackers: boolean;
  blockAds: boolean;
}

const DEFAULT_SETTINGS: BrowserSettings = {
  homepage: 'https://www.google.com',
  newTabPage: 'nebula://newtab',
  searchEngine: 'https://www.google.com/search?q=%s',
  geminiApiKey: '',
  theme: 'nebula',
  particleDensity: 60,
  reducedMotion: false,
  hardwareAcceleration: true,
  blockTrackers: true,
  blockAds: false,
};

export class Settings {
  private static instance: Settings;
  private settings: BrowserSettings = DEFAULT_SETTINGS;

  static async load(): Promise<BrowserSettings> {
    if (!Settings.instance) Settings.instance = new Settings();
    try {
      const stored = await invoke<string>('get_settings');
      if (stored) Settings.instance.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return Settings.instance.settings;
  }

  static get(): BrowserSettings {
    if (!Settings.instance) throw new Error('Settings not loaded');
    return Settings.instance.settings;
  }

  static async update(partial: Partial<BrowserSettings>) {
    if (!Settings.instance) throw new Error('Settings not loaded');
    Settings.instance.settings = { ...Settings.instance.settings, ...partial };
    await invoke('save_settings', { settings: JSON.stringify(Settings.instance.settings) });
  }

  static async setGeminiKey(key: string) {
    await Settings.update({ geminiApiKey: key });
  }
}
