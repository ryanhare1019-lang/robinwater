import { useEffect, useRef } from "react";
import { Canvas } from "./components/Canvas";
import { InputBox } from "./components/InputBox";
import { AiControlsBar } from "./components/AiControlsBar";
import { RightSidebar } from "./components/RightSidebar";
import { CanvasList } from "./components/CanvasList";
import { ContextMenu } from "./components/ContextMenu";
import { ConnectingLine } from "./components/ConnectingLine";
import { useStore } from "./store/useStore";
import { AppData, LegacyAppData } from "./types";
import { loadConfig } from "./utils/config";
import { triggerSuggest } from "./utils/triggerSuggest";

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

      // Ensure connections array exists on all canvases + migrate color→tags
      const data = parsed as AppData;
      data.canvases = data.canvases.map((c) => ({
        ...c,
        connections: c.connections || [],
        ideas: c.ideas.map((idea: any) => {
          if (idea.color !== undefined && !idea.tags) {
            const { color, ...rest } = idea;
            return { ...rest, tags: [color] };
          }
          return idea;
        }),
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

const AUTO_TRIGGER_DELAY_MS = 3_000;

export function App() {
  const selectedId = useStore((s) => s.selectedId);
  const lastAddedAt = useStore((s) => s.lastAddedAt);
  const rightOffset = selectedId ? 320 + 24 : 24;
  const newNodeId = useStore((s) => s.newNodeId);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const autoTriggerTimer = useRef<ReturnType<typeof setTimeout>>();
  // Track the newest idea text for auto-trigger
  const newestIdeaTextRef = useRef<string>('');

  useEffect(() => {
    loadData().then((data) => {
      if (data) {
        useStore.getState().hydrate(data);
      }
    });
    loadConfig().then((config) => {
      useStore.getState().setConfig(config);
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

  // Auto-trigger ghost suggestions 3s after a new idea is added
  useEffect(() => {
    if (lastAddedAt === 0) return;

    const config = useStore.getState().config;
    if (!config?.aiFeatures.ghostNodes) return;
    if (!config?.anthropicApiKey) return;

    // Capture the newest idea text at the moment of trigger, looked up by newNodeId
    const state = useStore.getState();
    const canvas = state.canvases.find((c) => c.id === state.activeCanvasId);
    const ideas = canvas?.ideas || [];
    const newestIdea = newNodeId ? ideas.find((i) => i.id === newNodeId) : undefined;
    if (!newestIdea) return; // idea already deleted or not found, skip
    newestIdeaTextRef.current = newestIdea.text;

    if (autoTriggerTimer.current) clearTimeout(autoTriggerTimer.current);
    autoTriggerTimer.current = setTimeout(() => {
      triggerSuggest('auto', newestIdeaTextRef.current);
    }, AUTO_TRIGGER_DELAY_MS);

    return () => {
      if (autoTriggerTimer.current) clearTimeout(autoTriggerTimer.current);
    };
  }, [lastAddedAt, newNodeId]);

  return (
    <>
      <Canvas />
      <div className="vignette" />
      <div className="vignette-sides" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 500 }} />
      <CanvasList />
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: rightOffset,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
          transition: "right 0.25s var(--ease-out)",
        }}
      >
        <AiControlsBar />
        <InputBox />
      </div>
      <ConnectingLine />
      <ContextMenu />
      {selectedId && <RightSidebar />}
    </>
  );
}
