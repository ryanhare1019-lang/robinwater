import { fetch } from "@tauri-apps/plugin-http";
import { getVersion } from "@tauri-apps/api/app";

const OWNER = "ryanhare1019-lang";
const REPO = "robinwater";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  downloadUrl: string;
}

function parseVer(v: string): [number, number, number] {
  const parts = v.replace(/^v/, "").split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewer(remote: string, current: string): boolean {
  const [rM, rN, rP] = parseVer(remote);
  const [cM, cN, cP] = parseVer(current);
  if (rM !== cM) return rM > cM;
  if (rN !== cN) return rN > cN;
  return rP > cP;
}

/**
 * Checks GitHub for a newer release. Returns null if up to date or offline.
 * Never throws — any network error is treated as "no update available".
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const currentVersion = await getVersion();

    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
      {
        method: "GET",
        headers: {
          "User-Agent": "Robinwater-Updater",
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!response.ok) return null;

    const release = (await response.json()) as {
      tag_name: string;
      assets: Array<{ name: string; browser_download_url: string }>;
    };

    if (!isNewer(release.tag_name, currentVersion)) return null;

    // Prefer NSIS setup, fall back to MSI
    const asset = release.assets.find(
      (a) =>
        a.name.includes("_x64-setup.exe") ||
        a.name.includes("_x64_en-US.msi")
    );
    if (!asset) return null;

    return {
      version: release.tag_name.replace(/^v/, ""),
      currentVersion,
      downloadUrl: asset.browser_download_url,
    };
  } catch {
    // Offline or API error — silently skip
    return null;
  }
}
