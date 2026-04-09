import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';

export interface AppConfig {
  anthropicApiKey: string;
  aiFeatures: {
    ghostNodes: boolean;
    autoTagging: boolean;
    questionGeneration: boolean;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  anthropicApiKey: '',
  aiFeatures: {
    ghostNodes: true,
    autoTagging: true,
    questionGeneration: true,
  },
};

const CONFIG_FILENAME = 'robinwater-config.json';

export async function loadConfig(): Promise<AppConfig> {
  try {
    const dir = await appDataDir();
    await mkdir(dir, { recursive: true }).catch(() => {});
    const filePath = await join(dir, CONFIG_FILENAME);
    if (await exists(filePath)) {
      const content = await readTextFile(filePath);
      const parsed = JSON.parse(content) as Partial<AppConfig>;
      // Merge with defaults so new fields are always present
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        aiFeatures: {
          ...DEFAULT_CONFIG.aiFeatures,
          ...(parsed.aiFeatures ?? {}),
        },
      };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return { ...DEFAULT_CONFIG, aiFeatures: { ...DEFAULT_CONFIG.aiFeatures } };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    const dir = await appDataDir();
    await mkdir(dir, { recursive: true }).catch(() => {});
    const filePath = await join(dir, CONFIG_FILENAME);
    await writeTextFile(filePath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}
