import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Plot, PixelSelection, ViewportState } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  evaluateSelection,
  applyDragSelection,
  rectsOverlap,
  computeSelectionBoundarySegments,
  PRICE_PER_PIXEL,
  hexToRgb,
} from '../lib/canvasUtils';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface CanvasEngineProps {
  plots: Plot[];
  mode: 'pan' | 'select';
  selectionAction?: 'add' | 'remove';
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  onSelectPlot: (plot: Plot) => void;
  onSelectionChange: (selection: PixelSelection | null) => void;
  selection: PixelSelection | null;
  hoveredPlotId: string | null;
}

export const CanvasEngine: React.FC<CanvasEngineProps> = ({
  plots,
  mode,
  selectionAction = 'add',
  viewport,
  onViewportChange,
  onSelectPlot,
  onSelectionChange,
  selection,
  hoveredPlotId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // In-memory offscreen master canvas for 1000x1000 pixel raster
  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const masterCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Interaction tracking state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedSignificantlyRef = useRef<boolean>(false);
  const mouseWorldPosRef = useRef<{ x: number; y: number }>({ x: 500, y: 500 });
  const isSpacePressedRef = useRef(false);
  const isAltPressedRef = useRef(false);

  // Active drag preview box for live visual feedback without mutating committed selection
  const [activeDragBox, setActiveDragBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const activeDragBoxRef = useRef(activeDragBox);
  activeDragBoxRef.current = activeDragBox;

  const isSelectingRef = useRef(false);
  const selectStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mobile pinch-zoom tracking
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Keep latest state refs for native non-passive event handlers
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const selectionActionRef = useRef(selectionAction);
  selectionActionRef.current = selectionAction;

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const plotsRef = useRef(plots);
  plotsRef.current = plots;

  // Initialize master 1000x1000 canvas in memory
  useEffect(() => {
    if (!masterCanvasRef.current) {
      const master = document.createElement('canvas');
      master.width = CANVAS_WIDTH;
      master.height = CANVAS_HEIGHT;
      const ctx = master.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.fillStyle = '#FAF8F5'; // warm cream base
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      masterCanvasRef.current = master;
      masterCtxRef.current = ctx;
    }
  }, []);

  // Update master canvas whenever plots array updates
  useEffect(() => {
    const ctx = masterCtxRef.current;
    if (!ctx) return;

    // Reset base canvas with subtle graph pattern
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle 50x50 and 100x100 grid markers on base
    ctx.strokeStyle = '#EAE4D9';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Paint all plots
    plots.forEach((plot) => {
      const w = plot.width;
      const h = plot.height;
      if (plot.pixels && plot.pixels.length === w * h) {
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;
        for (let i = 0; i < plot.pixels.length; i++) {
          const rgb = hexToRgb(plot.pixels[i] || '#000000');
          const idx = i * 4;
          data[idx] = rgb.r;
          data[idx + 1] = rgb.g;
          data[idx + 2] = rgb.b;
          data[idx + 3] = 255;
        }
        ctx.putImageData(imgData, plot.x, plot.y);
      } else {
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(plot.x, plot.y, w, h);
      }
    });

    renderCanvases();
  }, [plots]);

  // Coordinate transforms
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - viewport.x) / viewport.zoom,
        y: (screenY - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      return {
        x: worldX * viewport.zoom + viewport.x,
        y: worldY * viewport.zoom + viewport.y,
      };
    },
    [viewport]
  );

  // Resize canvas buffers to match container size
  const updateCanvasDimensions = useCallback(() => {
    if (!containerRef.current || !baseCanvasRef.current || !overlayCanvasRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const dpr = window.devicePixelRatio || 1;

    baseCanvasRef.current.width = clientWidth * dpr;
    baseCanvasRef.current.height = clientHeight * dpr;
    overlayCanvasRef.current.width = clientWidth * dpr;
    overlayCanvasRef.current.height = clientHeight * dpr;

    baseCanvasRef.current.style.width = `${clientWidth}px`;
    baseCanvasRef.current.style.height = `${clientHeight}px`;
    overlayCanvasRef.current.style.width = `${clientWidth}px`;
    overlayCanvasRef.current.style.height = `${clientHeight}px`;

    const baseCtx = baseCanvasRef.current.getContext('2d');
    const overlayCtx = overlayCanvasRef.current.getContext('2d');
    if (baseCtx) baseCtx.scale(dpr, dpr);
    if (overlayCtx) overlayCtx.scale(dpr, dpr);

    renderCanvases();
  }, []);

  useEffect(() => {
    updateCanvasDimensions();
    const handleResize = () => updateCanvasDimensions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateCanvasDimensions]);

  // Main Render Loop
  const renderCanvases = useCallback(() => {
    if (
      !baseCanvasRef.current ||
      !overlayCanvasRef.current ||
      !masterCanvasRef.current ||
      !containerRef.current
    )
      return;

    const baseCtx = baseCanvasRef.current.getContext('2d');
    const overlayCtx = overlayCanvasRef.current.getContext('2d');
    if (!baseCtx || !overlayCtx) return;

    const { clientWidth: width, clientHeight: height } = containerRef.current;

    // 1. Draw Base Master Layer
    baseCtx.imageSmoothingEnabled = false;
    baseCtx.clearRect(0, 0, width, height);

    // Fill background with warm studio tone
    baseCtx.fillStyle = '#ECE7DE';
    baseCtx.fillRect(0, 0, width, height);

    // Compute visible bounds
    const srcX = Math.max(0, -viewport.x / viewport.zoom);
    const srcY = Math.max(0, -viewport.y / viewport.zoom);
    const srcW = Math.min(CANVAS_WIDTH - srcX, width / viewport.zoom);
    const srcH = Math.min(CANVAS_HEIGHT - srcY, height / viewport.zoom);

    const dstX = Math.max(0, viewport.x);
    const dstY = Math.max(0, viewport.y);
    const dstW = srcW * viewport.zoom;
    const dstH = srcH * viewport.zoom;

    if (srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0) {
      baseCtx.drawImage(
        masterCanvasRef.current,
        srcX,
        srcY,
        srcW,
        srcH,
        dstX,
        dstY,
        dstW,
        dstH
      );
    }

    // Outer Canvas Solid Neo-Brutalist Border
    const canvasTopLeft = worldToScreen(0, 0);
    const canvasBottomRight = worldToScreen(CANVAS_WIDTH, CANVAS_HEIGHT);
    baseCtx.strokeStyle = '#000000';
    baseCtx.lineWidth = 3;
    baseCtx.strokeRect(
      canvasTopLeft.x,
      canvasTopLeft.y,
      canvasBottomRight.x - canvasTopLeft.x,
      canvasBottomRight.y - canvasTopLeft.y
    );

    // 2. Draw Overlay Layer (Grid, Hover, Selection Marquees)
    overlayCtx.clearRect(0, 0, width, height);

    // Render pixel grid lines when zoomed in sufficiently (>= 6x)
    if (viewport.zoom >= 6) {
      overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
      overlayCtx.lineWidth = 0.5;

      const startWorldX = Math.max(0, Math.floor(srcX));
      const endWorldX = Math.min(CANVAS_WIDTH, Math.ceil(srcX + srcW));
      const startWorldY = Math.max(0, Math.floor(srcY));
      const endWorldY = Math.min(CANVAS_HEIGHT, Math.ceil(srcY + srcH));

      overlayCtx.beginPath();
      for (let x = startWorldX; x <= endWorldX; x++) {
        const sx = Math.floor(x * viewport.zoom + viewport.x) + 0.5;
        overlayCtx.moveTo(sx, Math.max(0, canvasTopLeft.y));
        overlayCtx.lineTo(sx, Math.min(height, canvasBottomRight.y));
      }
      for (let y = startWorldY; y <= endWorldY; y++) {
        const sy = Math.floor(y * viewport.zoom + viewport.y) + 0.5;
        overlayCtx.moveTo(Math.max(0, canvasTopLeft.x), sy);
        overlayCtx.lineTo(Math.min(width, canvasBottomRight.x), sy);
      }
      overlayCtx.stroke();
    }

    // Highlight hovered plot
    if (hoveredPlotId) {
      const plot = plots.find((p) => p.id === hoveredPlotId);
      if (plot) {
        const p1 = worldToScreen(plot.x, plot.y);
        const pw = plot.width * viewport.zoom;
        const ph = plot.height * viewport.zoom;

        overlayCtx.strokeStyle = '#FFE169';
        overlayCtx.lineWidth = 4;
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);

        overlayCtx.strokeStyle = '#000000';
        overlayCtx.lineWidth = 1.5;
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);
      }
    }

    // Render all active selection regions (Multi-region & merged shapes support!)
    if (selection) {
      const regionsToRender =
        selection.regions && selection.regions.length > 0
          ? selection.regions
          : [
              {
                id: 'fallback_primary',
                x: selection.x,
                y: selection.y,
                width: selection.width,
                height: selection.height,
                pixelCount: selection.pixelCount,
                cost: selection.cost,
              },
            ];

      // 1. Fill all selection rects seamlessly with translucent teal
      overlayCtx.fillStyle = 'rgba(78, 205, 196, 0.38)';
      regionsToRender.forEach((region) => {
        const p1 = worldToScreen(region.x, region.y);
        const pw = region.width * viewport.zoom;
        const ph = region.height * viewport.zoom;
        overlayCtx.fillRect(p1.x, p1.y, pw, ph);
      });

      // 2. Draw unified perimeter boundary outline (ZERO internal borders between touching rectangles!)
      const boundarySegments = computeSelectionBoundarySegments(regionsToRender);
      overlayCtx.strokeStyle = '#000000';
      overlayCtx.lineWidth = 2.5;
      overlayCtx.setLineDash([6, 4]);
      overlayCtx.beginPath();
      boundarySegments.forEach((seg) => {
        const sp1 = worldToScreen(seg.x1, seg.y1);
        const sp2 = worldToScreen(seg.x2, seg.y2);
        overlayCtx.moveTo(sp1.x, sp1.y);
        overlayCtx.lineTo(sp2.x, sp2.y);
      });
      overlayCtx.stroke();
      overlayCtx.setLineDash([]);

      // Neo-brutalist Floating Info Tag near top-left of primary selection
      const p1 = worldToScreen(selection.x, selection.y);
      const areaCount = selection.connectedAreaCount ?? (regionsToRender.length > 1 ? regionsToRender.length : 1);
      const tagText =
        areaCount > 1
          ? `${areaCount} Areas • ${selection.pixelCount} px • $${selection.cost.toFixed(2)}`
          : `${selection.pixelCount} px • $${selection.cost.toFixed(2)}`;

      overlayCtx.font = 'bold 12px monospace';
      const textMetrics = overlayCtx.measureText(tagText);
      const tagW = textMetrics.width + 18;
      const tagH = 26;
      const tagX = Math.min(width - tagW - 10, Math.max(10, p1.x));
      const tagY = Math.max(10, p1.y - tagH - 6);

      // Tag Shadow & Box
      overlayCtx.fillStyle = '#000000';
      overlayCtx.fillRect(tagX + 3, tagY + 3, tagW, tagH);

      overlayCtx.fillStyle = '#FFE169';
      overlayCtx.fillRect(tagX, tagY, tagW, tagH);

      overlayCtx.strokeStyle = '#000000';
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(tagX, tagY, tagW, tagH);

      overlayCtx.fillStyle = '#000000';
      overlayCtx.fillText(tagText, tagX + 9, tagY + 17);
    }

    // 3. Render Active Drag Box Preview (Live dynamic visual feedback without modifying state)
    if (activeDragBox) {
      const minX = Math.max(0, Math.min(Math.round(activeDragBox.startX), Math.round(activeDragBox.currentX)));
      const maxX = Math.min(CANVAS_WIDTH - 1, Math.max(Math.round(activeDragBox.startX), Math.round(activeDragBox.currentX)));
      const minY = Math.max(0, Math.min(Math.round(activeDragBox.startY), Math.round(activeDragBox.currentY)));
      const maxY = Math.min(CANVAS_HEIGHT - 1, Math.max(Math.round(activeDragBox.startY), Math.round(activeDragBox.currentY)));
      const dw = Math.max(1, maxX - minX + 1);
      const dh = Math.max(1, maxY - minY + 1);
      const dragWorldRect = { x: minX, y: minY, width: dw, height: dh };

      const existingRegs = selection?.regions || [];
      const dragStartedInside = existingRegs.some(
        (r) =>
          activeDragBox.startX >= r.x &&
          activeDragBox.startX < r.x + r.width &&
          activeDragBox.startY >= r.y &&
          activeDragBox.startY < r.y + r.height
      );
      const overlapsExisting = existingRegs.some((r) => rectsOverlap(r, dragWorldRect));
      const isUnselect = isAltPressedRef.current || selectionActionRef.current === 'remove';

      const p1 = worldToScreen(minX, minY);
      const pw = dw * viewport.zoom;
      const ph = dh * viewport.zoom;

      if (isUnselect) {
        // Red / Coral preview indicating unselect/erase
        overlayCtx.fillStyle = 'rgba(255, 107, 107, 0.4)';
        overlayCtx.fillRect(p1.x, p1.y, pw, ph);

        overlayCtx.strokeStyle = '#D63031';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.setLineDash([4, 3]);
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);
        overlayCtx.setLineDash([]);
      } else {
        // Teal preview indicating adding new pixels
        overlayCtx.fillStyle = 'rgba(78, 205, 196, 0.45)';
        overlayCtx.fillRect(p1.x, p1.y, pw, ph);

        overlayCtx.strokeStyle = '#000000';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.setLineDash([6, 4]);
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);
        overlayCtx.setLineDash([]);
      }

      // Drag badge label
      const dragTagText = isUnselect
        ? `Erase (${dw}×${dh} px)`
        : `+ Area • ${dw}×${dh} = ${dw * dh} px`;

      overlayCtx.font = 'bold 11px monospace';
      const dMetrics = overlayCtx.measureText(dragTagText);
      const dTagW = dMetrics.width + 16;
      const dTagH = 24;
      const dTagX = Math.min(width - dTagW - 10, Math.max(10, p1.x));
      const dTagY = Math.max(10, p1.y - dTagH - 4);

      overlayCtx.fillStyle = isUnselect ? '#FF7675' : '#FFE169';
      overlayCtx.fillRect(dTagX, dTagY, dTagW, dTagH);

      overlayCtx.strokeStyle = '#000000';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.strokeRect(dTagX, dTagY, dTagW, dTagH);

      overlayCtx.fillStyle = '#000000';
      overlayCtx.fillText(dragTagText, dTagX + 8, dTagY + 16);
    }
  }, [viewport, plots, selection, hoveredPlotId, activeDragBox, worldToScreen]);

  useEffect(() => {
    renderCanvases();
  }, [renderCanvases]);

  // Keyboard modifiers for spacebar panning and Alt deselecting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
      }
      if (e.altKey) {
        isAltPressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
      if (!e.altKey) {
        isAltPressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Native NON-PASSIVE Event Listeners on container to PREVENT browser window zooming & scrolling!
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wheel zoom strictly inside canvas
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentVp = viewportRef.current;
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
      const newZoom = Math.min(32, Math.max(0.2, currentVp.zoom * zoomFactor));

      const newX = mouseX - ((mouseX - currentVp.x) * newZoom) / currentVp.zoom;
      const newY = mouseY - ((mouseY - currentVp.y) * newZoom) / currentVp.zoom;

      onViewportChange({
        x: newX,
        y: newY,
        zoom: newZoom,
      });
    };

    // Touch start
    const handleNativeTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = container.getBoundingClientRect();
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const currentVp = viewportRef.current;
        const worldX = (screenX - currentVp.x) / currentVp.zoom;
        const worldY = (screenY - currentVp.y) / currentVp.zoom;

        isDraggingRef.current = true;
        dragStartRef.current = { x: screenX, y: screenY };

        if (modeRef.current === 'select') {
          isSelectingRef.current = true;
          selectStartWorldRef.current = { x: worldX, y: worldY };
          setActiveDragBox({
            startX: worldX,
            startY: worldY,
            currentX: worldX,
            currentY: worldY,
          });
        }
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        touchStartCenterRef.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      }
    };

    // Touch move
    const handleNativeTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevents browser pulling/zooming the whole page
      const rect = container.getBoundingClientRect();

      if (e.touches.length === 1 && isDraggingRef.current) {
        const touch = e.touches[0];
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const dx = screenX - dragStartRef.current.x;
        const dy = screenY - dragStartRef.current.y;
        const currentVp = viewportRef.current;

        if (modeRef.current === 'pan') {
          onViewportChange({
            ...currentVp,
            x: currentVp.x + dx,
            y: currentVp.y + dy,
          });
          dragStartRef.current = { x: screenX, y: screenY };
        } else if (modeRef.current === 'select' && isSelectingRef.current) {
          const worldX = (screenX - currentVp.x) / currentVp.zoom;
          const worldY = (screenY - currentVp.y) / currentVp.zoom;
          setActiveDragBox({
            startX: selectStartWorldRef.current.x,
            startY: selectStartWorldRef.current.y,
            currentX: worldX,
            currentY: worldY,
          });
        }
      } else if (e.touches.length === 2 && touchStartDistRef.current) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const ratio = dist / touchStartDistRef.current;
        const currentVp = viewportRef.current;
        const newZoom = Math.min(32, Math.max(0.2, currentVp.zoom * ratio));
        touchStartDistRef.current = dist;

        onViewportChange({
          ...currentVp,
          zoom: newZoom,
        });
      }
    };

    // Commit and finalize selection drag
    const commitSelectionDrag = (endClientX?: number, endClientY?: number, isAlt?: boolean) => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;
      isDraggingRef.current = false;

      const curBox = activeDragBoxRef.current;
      setActiveDragBox(null);

      const startW = curBox ? { x: curBox.startX, y: curBox.startY } : selectStartWorldRef.current;
      let endW = curBox ? { x: curBox.currentX, y: curBox.currentY } : selectStartWorldRef.current;

      if (endClientX !== undefined && endClientY !== undefined && container) {
        const rect = container.getBoundingClientRect();
        const vp = viewportRef.current;
        const sx = endClientX - rect.left;
        const sy = endClientY - rect.top;
        endW = {
          x: (sx - vp.x) / vp.zoom,
          y: (sy - vp.y) / vp.zoom,
        };
      }

      const worldDist = Math.hypot(endW.x - startW.x, endW.y - startW.y);
      const forceAction =
        isAlt || isAltPressedRef.current || selectionActionRef.current === 'remove' ? 'remove' : undefined;

      if (worldDist >= 1.0 || hasMovedSignificantlyRef.current) {
        const newSel = applyDragSelection(
          startW.x,
          startW.y,
          endW.x,
          endW.y,
          plotsRef.current,
          selectionRef.current?.regions || [],
          forceAction
        );
        onSelectionChange(newSel);
      } else {
        // Stationary single click in select mode
        const clickedPlot = plotsRef.current.find(
          (p) =>
            endW.x >= p.x &&
            endW.x < p.x + p.width &&
            endW.y >= p.y &&
            endW.y < p.y + p.height
        );

        if (clickedPlot) {
          onSelectPlot(clickedPlot);
        } else {
          const newSel = applyDragSelection(
            endW.x,
            endW.y,
            endW.x,
            endW.y,
            plotsRef.current,
            selectionRef.current?.regions || [],
            forceAction
          );
          onSelectionChange(newSel);
        }
      }
    };

    const handleNativeTouchEnd = () => {
      touchStartDistRef.current = null;
      touchStartCenterRef.current = null;

      if (modeRef.current === 'select' && isSelectingRef.current) {
        commitSelectionDrag();
      } else {
        isDraggingRef.current = false;
      }
    };

    // Global pointer/mouse up listeners so dragging/panning is NEVER stuck even if cursor leaves window or goes over toolbar
    const handleGlobalPointerUp = (e: Event) => {
      const mouseEvt = e as MouseEvent;
      if (isSelectingRef.current) {
        commitSelectionDrag(mouseEvt.clientX, mouseEvt.clientY, mouseEvt.altKey);
      } else if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }
    };

    const handleWindowBlur = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('blur', handleWindowBlur);

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    container.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    container.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    container.addEventListener('touchend', handleNativeTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('blur', handleWindowBlur);
      container.removeEventListener('wheel', handleNativeWheel);
      container.removeEventListener('touchstart', handleNativeTouchStart);
      container.removeEventListener('touchmove', handleNativeTouchMove);
      container.removeEventListener('touchend', handleNativeTouchEnd);
    };
  }, [onViewportChange, onSelectionChange, onSelectPlot]);

  // Desktop Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    isDraggingRef.current = true;
    dragStartRef.current = { x: screenX, y: screenY };
    mouseDownPosRef.current = { x: screenX, y: screenY };
    hasMovedSignificantlyRef.current = false;

    if (e.button === 1 || isSpacePressedRef.current || mode === 'pan') {
      return;
    }

    if (e.button === 0 && mode === 'select') {
      isSelectingRef.current = true;
      selectStartWorldRef.current = { x: worldPos.x, y: worldPos.y };
      setActiveDragBox({
        startX: worldPos.x,
        startY: worldPos.y,
        currentX: worldPos.x,
        currentY: worldPos.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    mouseWorldPosRef.current = worldPos;

    if (!isDraggingRef.current) return;

    const totalDistMoved = Math.hypot(
      screenX - mouseDownPosRef.current.x,
      screenY - mouseDownPosRef.current.y
    );
    if (totalDistMoved >= 4) {
      hasMovedSignificantlyRef.current = true;
    }

    const dx = screenX - dragStartRef.current.x;
    const dy = screenY - dragStartRef.current.y;

    if (e.buttons === 4 || isSpacePressedRef.current || mode === 'pan') {
      onViewportChange({
        ...viewport,
        x: viewport.x + dx,
        y: viewport.y + dy,
      });
      dragStartRef.current = { x: screenX, y: screenY };
    } else if (mode === 'select' && isSelectingRef.current) {
      setActiveDragBox({
        startX: selectStartWorldRef.current.x,
        startY: selectStartWorldRef.current.y,
        currentX: worldPos.x,
        currentY: worldPos.y,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    const moved = hasMovedSignificantlyRef.current;

    if (mode === 'select' && isSelectingRef.current) {
      isSelectingRef.current = false;
      isDraggingRef.current = false;
      const curBox = activeDragBoxRef.current;
      setActiveDragBox(null);

      const startW = curBox ? { x: curBox.startX, y: curBox.startY } : selectStartWorldRef.current;
      const endW = curBox ? { x: curBox.currentX, y: curBox.currentY } : worldPos;
      const worldDist = Math.hypot(endW.x - startW.x, endW.y - startW.y);
      const forceAction =
        e.altKey || isAltPressedRef.current || selectionAction === 'remove' ? 'remove' : undefined;

      if (worldDist >= 1.0 || moved) {
        const newSel = applyDragSelection(
          startW.x,
          startW.y,
          endW.x,
          endW.y,
          plots,
          selection?.regions || [],
          forceAction
        );
        onSelectionChange(newSel);
      } else {
        // Stationary single click in select mode
        const clickedPlot = plots.find(
          (p) =>
            worldPos.x >= p.x &&
            worldPos.x < p.x + p.width &&
            worldPos.y >= p.y &&
            worldPos.y < p.y + p.height
        );

        if (clickedPlot) {
          onSelectPlot(clickedPlot);
        } else {
          // Add 1x1 pixel
          const newSel = applyDragSelection(
            worldPos.x,
            worldPos.y,
            worldPos.x,
            worldPos.y,
            plots,
            selection?.regions || [],
            forceAction
          );
          onSelectionChange(newSel);
        }
      }
    } else if (mode === 'pan' || !isSelectingRef.current) {
      isDraggingRef.current = false;
      // ONLY trigger onSelectPlot if the user did NOT drag the screen! (Pure stationary click)
      if (!moved) {
        const clickedPlot = plots.find(
          (p) =>
            worldPos.x >= p.x &&
            worldPos.x < p.x + p.width &&
            worldPos.y >= p.y &&
            worldPos.y < p.y + p.height
        );

        if (clickedPlot) {
          onSelectPlot(clickedPlot);
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      id="canvas-viewport-container"
      className={`relative w-full h-full overflow-hidden bg-[#ECE7DE] select-none touch-none ${
        mode === 'pan' || isSpacePressedRef.current
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-crosshair'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Base Canvas */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-none"
      />

      {/* Interactive Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-none"
      />

      {/* Auto-Deselect Exclusion Toast Banner if owned pixels were trimmed */}
      {selection?.notificationMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-lg w-11/12 sm:w-auto bg-[#FFE169] border-[2.5px] border-black shadow-[4px_4px_0px_#000] px-4 py-2 rounded-xl flex items-center gap-2.5 text-xs font-black font-mono text-black z-20 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-black shrink-0" />
          <span>{selection.notificationMessage}</span>
        </div>
      )}

      {/* Floating Coordinate HUD in bottom-left */}
      <div className="absolute bottom-4 left-4 bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] px-3 py-1.5 rounded-xl flex items-center gap-3 text-xs font-mono font-bold pointer-events-none z-10">
        <div>
          <span className="text-gray-500">POS: </span>
          <span className="text-black">
            X:{Math.min(CANVAS_WIDTH - 1, Math.max(0, Math.floor(mouseWorldPosRef.current.x)))}, Y:
            {Math.min(CANVAS_HEIGHT - 1, Math.max(0, Math.floor(mouseWorldPosRef.current.y)))}
          </span>
        </div>
        <div className="text-gray-300">|</div>
        <div>
          <span className="text-gray-500">ZOOM: </span>
          <span className="text-black">{Math.round(viewport.zoom * 100)}%</span>
        </div>
        <div className="text-gray-300">|</div>
        <div>
          <span className="text-gray-500">SIZE: </span>
          <span className="text-black">1M PIXELS</span>
        </div>
      </div>
    </div>
  );
};
