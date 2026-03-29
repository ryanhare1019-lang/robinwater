import { useRef, useCallback, useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { IdeaNode } from "./IdeaNode";
import { SimilarityLines } from "./SimilarityLines";
import { ConnectionLines } from "./ConnectionLines";
import { Background } from "./Background";
import { Particles } from "./Particles";

const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4.0;

export function Canvas() {
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const setViewport = useStore((s) => s.setViewport);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const selectedId = useStore((s) => s.selectedId);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const connectingFrom = useStore((s) => s.connectingFrom);
  const setConnectingFrom = useStore((s) => s.setConnectingFrom);

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  const ideas = canvas?.ideas || [];
  const viewport = canvas?.viewport || { x: 0, y: 0, zoom: 1 };

  const [isPanning, setIsPanning] = useState(false);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Cancel connection mode on canvas click
      if (connectingFrom) {
        setConnectingFrom(null);
        return;
      }

      if (e.button === 0 || e.button === 1) {
        panning.current = true;
        setIsPanning(true);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          vx: viewport.x,
          vy: viewport.y,
        };
        setSelectedId(null);
        setContextMenu(null, null);
      }
    },
    [viewport.x, viewport.y, setSelectedId, connectingFrom, setConnectingFrom, setContextMenu]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setViewport({
        x: panStart.current.vx + dx,
        y: panStart.current.vy + dy,
      });
    };

    const onUp = () => {
      panning.current = false;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setViewport]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, viewport.zoom * delta));
      if (newZoom === viewport.zoom) return;
      const ratio = newZoom / viewport.zoom;
      const cx = e.clientX;
      const cy = e.clientY;

      setViewport({
        zoom: newZoom,
        x: cx - ratio * (cx - viewport.x),
        y: cy - ratio * (cy - viewport.y),
      });
    },
    [viewport, setViewport]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (selectedId) {
          // Open sidebar (it'll show via selectedId already)
        }
      }
      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, setViewport]);

  return (
    <div
      onMouseDown={onMouseDown}
      onWheel={onWheel}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        cursor: connectingFrom ? "crosshair" : isPanning ? "grabbing" : "grab",
      }}
    >
      <div
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          transition: "none",
        }}
      >
        <Background />
        <Particles />
        <SimilarityLines />
        <ConnectionLines />
        {ideas.map((idea) => (
          <IdeaNode key={idea.id} idea={idea} />
        ))}
      </div>
    </div>
  );
}
