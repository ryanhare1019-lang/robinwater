import { useRef, useCallback, useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { IdeaNode } from "./IdeaNode";
import { GhostNodeCard } from "./GhostNodeCard";
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
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const clearSelection = useStore((s) => s.clearSelection);

  const ghostNodes = useStore((s) => s.ghostNodes);
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

  // Drag-select box state
  const [selectBox, setSelectBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const applyTransform = useCallback((x: number, y: number, zoom: number) => {
    if (transformRef.current) {
      transformRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }
  }, []);

  // Keep ref in sync when store changes (e.g. Ctrl+0 reset)
  useEffect(() => {
    viewportRef.current = viewport;
    applyTransform(viewport.x, viewport.y, viewport.zoom);
  }, [viewport, applyTransform]);

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

      if (e.button === 0 && e.shiftKey) {
        // Shift+drag on empty canvas — start drag-select box
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        setSelectBox({ x: startClientX, y: startClientY, w: 0, h: 0 });

        const onMove = (ev: MouseEvent) => {
          const w = ev.clientX - startClientX;
          const h = ev.clientY - startClientY;
          setSelectBox({ x: startClientX, y: startClientY, w, h });
        };

        const onUp = (ev: MouseEvent) => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          setSelectBox(null);

          // Compute selection rect in client coords (normalized)
          const rawX = startClientX;
          const rawY = startClientY;
          const rawW = ev.clientX - startClientX;
          const rawH = ev.clientY - startClientY;
          const minClientX = rawW >= 0 ? rawX : rawX + rawW;
          const maxClientX = rawW >= 0 ? rawX + rawW : rawX;
          const minClientY = rawH >= 0 ? rawY : rawY + rawH;
          const maxClientY = rawH >= 0 ? rawY + rawH : rawY;

          // Convert to canvas coordinates
          const vp = viewportRef.current;
          const minCanvasX = (minClientX - vp.x) / vp.zoom;
          const maxCanvasX = (maxClientX - vp.x) / vp.zoom;
          const minCanvasY = (minClientY - vp.y) / vp.zoom;
          const maxCanvasY = (maxClientY - vp.y) / vp.zoom;

          // Find all ideas whose origin falls within the rect
          const state = useStore.getState();
          const activeCanvas = state.canvases.find((c) => c.id === state.activeCanvasId);
          const hitIds = (activeCanvas?.ideas || [])
            .filter(
              (idea) =>
                idea.x >= minCanvasX &&
                idea.x <= maxCanvasX &&
                idea.y >= minCanvasY &&
                idea.y <= maxCanvasY
            )
            .map((idea) => idea.id);

          if (hitIds.length > 0) {
            setSelectedIds(hitIds);
          }
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
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
    [setSelectedId, connectingFrom, setConnectingFrom, setContextMenu, setSelectedIds]
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

    const onRightUp = (e: MouseEvent) => {
      if (e.button === 2) {
        const state = useStore.getState();
        if (state.connectingFrom) {
          state.setConnectingFrom(null);
        }
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseup", onRightUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseup", onRightUp);
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
          if (deleteConfirmPending) {
            // Second Delete press confirms deletion
            cancelDeleteConfirm();
            setDeletingNodeId(selectedId);
            const idToDelete = selectedId;
            setTimeout(() => {
              deleteIdea(idToDelete);
              setSelectedId(null);
            }, 250);
          } else {
            setDeleteConfirmPending(true);
            if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current);
            deleteConfirmTimer.current = setTimeout(() => {
              setDeleteConfirmPending(false);
              deleteConfirmTimer.current = null;
            }, 4000);
          }
        }
      }

      if (e.key === "Escape") {
        if (deleteConfirmPending) {
          e.preventDefault();
          cancelDeleteConfirm();
        }
        // Also clear multi-selection on Escape
        const state = useStore.getState();
        if (state.selectedIds.length > 1) {
          clearSelection();
        }
      }

      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        if (ideas.length === 0) {
          setViewport({ x: 0, y: 0, zoom: 1 });
        } else {
          const midX = ideas.reduce((sum, i) => sum + i.x, 0) / ideas.length;
          const midY = ideas.reduce((sum, i) => sum + i.y, 0) / ideas.length;
          setViewport({ x: window.innerWidth / 2 - midX, y: window.innerHeight / 2 - midY, zoom: 1 });
        }
      }

      if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        const vp = viewportRef.current;
        const newZoom = Math.min(ZOOM_MAX, vp.zoom * 1.08);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const canvasX = (cx - vp.x) / vp.zoom;
        const canvasY = (cy - vp.y) / vp.zoom;
        setViewport({ x: cx - canvasX * newZoom, y: cy - canvasY * newZoom, zoom: newZoom });
      }

      if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        const vp = viewportRef.current;
        const newZoom = Math.max(ZOOM_MIN, vp.zoom * 0.92);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const canvasX = (cx - vp.x) / vp.zoom;
        const canvasY = (cy - vp.y) / vp.zoom;
        setViewport({ x: cx - canvasX * newZoom, y: cy - canvasY * newZoom, zoom: newZoom });
      }

      if ((e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") && !inInput) {
        if (ideas.length === 0) return;
        e.preventDefault();
        const currentIndex = ideas.findIndex((i) => i.id === selectedId);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % ideas.length;
          setSelectedId(ideas[nextIndex].id);
        } else {
          const prevIndex = currentIndex === -1 ? ideas.length - 1 : (currentIndex - 1 + ideas.length) % ideas.length;
          setSelectedId(ideas[prevIndex].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current);
    };
  }, [selectedId, deleteConfirmPending, setViewport, deleteIdea, setDeletingNodeId, setSelectedId, cancelDeleteConfirm, clearSelection, ideas]);

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
          {ghostNodes.map((ghost) => (
            <GhostNodeCard key={ghost.id} ghost={ghost} />
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
          DELETE?&nbsp;&nbsp;[DELETE] confirm&nbsp;&nbsp;[ESC] cancel
        </div>
      )}
      {selectBox && (
        <div
          style={{
            position: "fixed",
            left: selectBox.w >= 0 ? selectBox.x : selectBox.x + selectBox.w,
            top: selectBox.h >= 0 ? selectBox.y : selectBox.y + selectBox.h,
            width: Math.abs(selectBox.w),
            height: Math.abs(selectBox.h),
            border: "1px dashed var(--accent-blue)",
            background: "rgba(107, 155, 255, 0.06)",
            pointerEvents: "none",
            zIndex: 1500,
          }}
        />
      )}
    </>
  );
}
