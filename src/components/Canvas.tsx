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
  const deleteIdea = useStore((s) => s.deleteIdea);
  const setDeletingNodeId = useStore((s) => s.setDeletingNodeId);

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  const ideas = canvas?.ideas || [];
  const viewport = canvas?.viewport || { x: 0, y: 0, zoom: 1 };

  // Refs for direct DOM manipulation — avoids React re-renders during pan/zoom
  const transformRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  const zoomCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete confirmation state
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  const deleteConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync when store changes (e.g. Ctrl+0 reset)
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const applyTransform = useCallback((x: number, y: number, zoom: number) => {
    if (transformRef.current) {
      transformRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }
  }, []);

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
          vx: viewportRef.current.x,
          vy: viewportRef.current.y,
        };
        setSelectedId(null);
        setContextMenu(null, null);
      }
    },
    [setSelectedId, connectingFrom, setConnectingFrom, setContextMenu]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panning.current) return;
      const newX = panStart.current.vx + (e.clientX - panStart.current.x);
      const newY = panStart.current.vy + (e.clientY - panStart.current.y);
      viewportRef.current = { ...viewportRef.current, x: newX, y: newY };
      applyTransform(newX, newY, viewportRef.current.zoom);
    };

    const onUp = () => {
      if (!panning.current) return;
      panning.current = false;
      setIsPanning(false);
      // Commit final position to store once, not on every mousemove
      setViewport({ x: viewportRef.current.x, y: viewportRef.current.y });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setViewport, applyTransform]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const vp = viewportRef.current;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vp.zoom * delta));
      if (newZoom === vp.zoom) return;
      const ratio = newZoom / vp.zoom;
      const newX = e.clientX - ratio * (e.clientX - vp.x);
      const newY = e.clientY - ratio * (e.clientY - vp.y);

      viewportRef.current = { x: newX, y: newY, zoom: newZoom };
      applyTransform(newX, newY, newZoom);

      // Debounce store commit so we don't re-render on every wheel tick
      if (zoomCommitTimer.current) clearTimeout(zoomCommitTimer.current);
      zoomCommitTimer.current = setTimeout(() => {
        setViewport(viewportRef.current);
        zoomCommitTimer.current = null;
      }, 80);
    },
    [setViewport, applyTransform]
  );

  const cancelDeleteConfirm = useCallback(() => {
    setDeleteConfirmPending(false);
    if (deleteConfirmTimer.current) {
      clearTimeout(deleteConfirmTimer.current);
      deleteConfirmTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "Delete" || e.key === "Backspace") {
        if (inInput) return;
        if (selectedId) {
          e.preventDefault();
          setDeleteConfirmPending(true);
          if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current);
          deleteConfirmTimer.current = setTimeout(() => {
            setDeleteConfirmPending(false);
            deleteConfirmTimer.current = null;
          }, 4000);
        }
      }

      if (e.key === "Enter" && deleteConfirmPending && selectedId) {
        e.preventDefault();
        cancelDeleteConfirm();
        setDeletingNodeId(selectedId);
        const idToDelete = selectedId;
        setTimeout(() => {
          deleteIdea(idToDelete);
          setSelectedId(null);
        }, 250);
      }

      if (e.key === "Escape" && deleteConfirmPending) {
        e.preventDefault();
        cancelDeleteConfirm();
      }

      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current);
    };
  }, [selectedId, deleteConfirmPending, setViewport, deleteIdea, setDeletingNodeId, setSelectedId, cancelDeleteConfirm]);

  return (
    <>
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
          ref={transformRef}
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            willChange: "transform",
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
      {deleteConfirmPending && (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-raised)",
            border: "1px solid var(--accent-red)",
            color: "var(--accent-red)",
            padding: "10px 20px",
            zIndex: 2000,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--body-size)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          DELETE?&nbsp;&nbsp;[ENTER] confirm&nbsp;&nbsp;[ESC] cancel
        </div>
      )}
    </>
  );
}
