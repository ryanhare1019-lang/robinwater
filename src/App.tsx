import { useEffect, useRef } from "react";
import { Canvas } from "./components/Canvas";
import { InputBox } from "./components/InputBox";
import { RightSidebar } from "./components/RightSidebar";
import { CanvasList } from "./components/CanvasList";
import { ContextMenu } from "./components/ContextMenu";
import { ConnectingLine } from "./components/ConnectingLine";
import { useStore } from "./store/useStore";
import { AppData, LegacyAppData } from "./types";

const DATA_FILE = "robinwater-data.json";

function migrateV1(data: LegacyAppData): AppData {
  const id = crypto.randomUUID();
  return {
    canvases: [
      {
        id,
        name: "Ideas",
        ideas: data.ideas,
        connections: [],
        viewport: data.viewport,
      },
    ],
    activeCanvasId: id,
  };
}

async function loadData(): Promise<AppData | null> {
  try {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { readTextFile, exists, mkdir } = await import("@tauri-apps/plugin-fs");
    const dir = await appDataDir();
    await mkdir(dir, { recursive: true }).catch(() => {});
    const filePath = await join(dir, DATA_FILE);
    if (await exists(filePath)) {
      const content = await readTextFile(filePath);
      const parsed = JSON.parse(content);

      // Migrate v1 format
      if (parsed.ideas && !parsed.canvases) {
        return migrateV1(parsed as LegacyAppData);
      }

      // Ensure connections array exists on all canvases
      const data = parsed as AppData;
      data.canvases = data.canvases.map((c) => ({
        ...c,
        connections: c.connections || [],
      }));
      return data;
    }
  } catch (e) {
    console.error("Failed to load data:", e);
  }
  return null;
}

async function saveData(data: AppData): Promise<void> {
  try {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
    const dir = await appDataDir();
    await mkdir(dir, { recursive: true }).catch(() => {});
    const filePath = await join(dir, DATA_FILE);
    await writeTextFile(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save data:", e);
  }
}

export function App() {
  const selectedId = useStore((s) => s.selectedId);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadData().then((data) => {
      if (data) {
        useStore.getState().hydrate(data);
      }
    });
  }, []);

  useEffect(() => {
    const unsub = useStore.subscribe(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveData(useStore.getState().getSnapshot());
      }, 500);
    });
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <>
      <Canvas />
      <div className="vignette" />
      <div className="vignette-sides" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 500 }} />
      <CanvasList />
      <InputBox />
      <ConnectingLine />
      <ContextMenu />
      {selectedId && <RightSidebar />}
    </>
  );
}
