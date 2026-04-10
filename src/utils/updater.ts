import { fetch } from "@tauri-apps/plugin-http";
import { getVersion } from "@tauri-apps/api/app";

const OWNER = "ryanhare1019-lang";
const REPO = "monolite";

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

/** Returns asset name substrings to match, in priority order, for the current platform. */
function getAssetCandidates(): string[] {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) {
    return ["_x64-setup.exe", "_x64_en-US.msi"];
  }
  if (ua.includes("Macintosh") || ua.includes("Mac OS")) {
    // Check for Apple Silicon via the newer userAgentData API when available
    const isArm =
      ua.toLowerCase().includes("arm") ||
      ((navigator as any).userAgentData?.platform === "macOS" &&
        (navigator as any).userAgentData?.architecture === "arm");
    return isArm ? ["_aarch64.dmg", "_x64.dmg"] : ["_x64.dmg", "_aarch64.dmg"];
  }
  // Linux
  return ["_amd64.AppImage", "_amd64.deb"];
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
          "User-Agent": "Monolite-Updater",
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

    // Pick the first matching asset for this platform
    const candidates = getAssetCandidates();
    let asset: { name: string; browser_download_url: string } | undefined;
    for (const candidate of candidates) {
      asset = release.assets.find((a) => a.name.includes(candidate));
      if (asset) break;
    }
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
