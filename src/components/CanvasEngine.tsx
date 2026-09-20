import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Plot,
  PixelSelection,
  ViewportState,
  WorkflowStep,
  SelectTool,
  PaintTool,
} from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  applyDragSelection,
  computeSelectionBoundarySegments,
  hexToRgb,
  rgbToHex,
  getSelectionPixelSet,
  getLinePixels,
} from '../lib/canvasUtils';
import {
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize,
  Compass,
  Grid,
} from 'lucide-react';

interface CanvasEngineProps {
  plots: Plot[];
  step: WorkflowStep;
  selectTool: SelectTool;
  paintTool: PaintTool;
  currentColor: string;
  onColorChange: (color: string) => void;
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  onSelectPlot: (plot: Plot) => void;
  onInspectPixel: (x: number, y: number) => void;
  onSelectionChange: (selection: PixelSelection | null) => void;
  selection: PixelSelection | null;
  draftPixels: Map<string, string>;
  onPaintPixel: (x: number, y: number, color: string) => void;
  onFillSelection: (color: string) => void;
  hoveredPlotId: string | null;
  onHoverPlot?: (id: string | null) => void;
}

export const CanvasEngine: React.FC<CanvasEngineProps> = ({
  plots,
  step,
  selectTool,
  paintTool,
  currentColor,
  onColorChange,
  viewport,
  onViewportChange,
  onSelectPlot,
  onInspectPixel,
  onSelectionChange,
  selection,
  draftPixels,
  onPaintPixel,
  onFillSelection,
  hoveredPlotId,
  onHoverPlot,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // In-memory master canvas for 1000x1000 raster
  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const masterCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Interaction tracking state
  const isMouseDownRef = useRef(false);
  const isDraggingCanvasRef = useRef(false);
  const isSelectingMarqueeRef = useRef(false);
  const isPaintingStrokeRef = useRef(false);

  const dragStartScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedSignificantlyRef = useRef(false);
  const mouseWorldPosRef = useRef<{ x: number; y: number }>({ x: 500, y: 500 });
  const lastPaintedPixelRef = useRef<{ x: number; y: number } | null>(null);
  const isSpacePressedRef = useRef(false);

  // Touch tracking references
  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartMidpointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartViewportRef = useRef<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const touchStartScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartTimeRef = useRef<number>(0);
  const hasTouchMovedRef = useRef<boolean>(false);
  const lastTouchScreenPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Visual touch loupe / reticle state for mobile feedback
  const [touchReticle, setTouchReticle] = useState<{
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    active: boolean;
  } | null>(null);

  // Active marquee drag preview
  const [activeDragBox, setActiveDragBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const activeDragBoxRef = useRef(activeDragBox);
  activeDragBoxRef.current = activeDragBox;

  // Latest state references for native events
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const stepRef = useRef(step);
  stepRef.current = step;

  const selectToolRef = useRef(selectTool);
  selectToolRef.current = selectTool;

  const paintToolRef = useRef(paintTool);
  paintToolRef.current = paintTool;

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const plotsRef = useRef(plots);
  plotsRef.current = plots;

  const currentColorRef = useRef(currentColor);
  currentColorRef.current = currentColor;

  const draftPixelsRef = useRef(draftPixels);
  draftPixelsRef.current = draftPixels;

  // Fast lookup set of selected pixel coordinates
  const selectedPixelSet = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedPixelSet.current = getSelectionPixelSet(selection);
  }, [selection]);

  // Initialize master 1000x1000 canvas in memory
  useEffect(() => {
    if (!masterCanvasRef.current) {
      const master = document.createElement('canvas');
      master.width = CANVAS_WIDTH;
      master.height = CANVAS_HEIGHT;
      const ctx = master.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.fillStyle = '#FAF8F5';
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

    // Reset base canvas
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle 50x50 and 100x100 grid markers on master canvas
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
        const imgData = ctx.getImageData(plot.x, plot.y, w, h);
        const data = imgData.data;
        for (let i = 0; i < plot.pixels.length; i++) {
          const pxColor = plot.pixels[i];
          if (!pxColor || pxColor === 'transparent') {
            continue;
          }
          const rgb = hexToRgb(pxColor);
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
      const vp = viewportRef.current;
      return {
        x: (screenX - vp.x) / vp.zoom,
        y: (screenY - vp.y) / vp.zoom,
      };
    },
    []
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      const vp = viewportRef.current;
      return {
        x: worldX * vp.zoom + vp.x,
        y: worldY * vp.zoom + vp.y,
      };
    },
    []
  );

  // Resize canvas elements to fit container resolution
  const updateCanvasSizes = useCallback(() => {
    const container = containerRef.current;
    const base = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!container || !base || !overlay) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (base.width !== width * dpr || base.height !== height * dpr) {
      base.width = width * dpr;
      base.height = height * dpr;
      base.style.width = `${width}px`;
      base.style.height = `${height}px`;

      const ctx = base.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.scale(dpr, dpr);
      }
    }

    if (overlay.width !== width * dpr || overlay.height !== height * dpr) {
      overlay.width = width * dpr;
      overlay.height = height * dpr;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;

      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.scale(dpr, dpr);
      }
    }
  }, []);

  // Main Render Loop
  const renderCanvases = useCallback(() => {
    updateCanvasSizes();

    const container = containerRef.current;
    const baseCanvas = baseCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const master = masterCanvasRef.current;

    if (!container || !baseCanvas || !overlayCanvas || !master) return;

    const baseCtx = baseCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!baseCtx || !overlayCtx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const vp = viewportRef.current;

    // 1. BASE CANVAS RENDER
    baseCtx.clearRect(0, 0, width, height);

    // Canvas Background backdrop
    baseCtx.fillStyle = '#ECE7DE';
    baseCtx.fillRect(0, 0, width, height);

    // Canvas Sheet Shadow & Outline
    const canvasP0 = worldToScreen(0, 0);
    const canvasP1 = worldToScreen(CANVAS_WIDTH, CANVAS_HEIGHT);
    const sheetW = canvasP1.x - canvasP0.x;
    const sheetH = canvasP1.y - canvasP0.y;

    baseCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    baseCtx.fillRect(canvasP0.x + 8, canvasP0.y + 8, sheetW, sheetH);

    baseCtx.fillStyle = '#FAF8F5';
    baseCtx.fillRect(canvasP0.x, canvasP0.y, sheetW, sheetH);

    // Render Master Raster
    baseCtx.drawImage(
      master,
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      canvasP0.x,
      canvasP0.y,
      sheetW,
      sheetH
    );

    // Outer Border
    baseCtx.strokeStyle = '#000000';
    baseCtx.lineWidth = Math.max(2, 2.5 * Math.min(1, vp.zoom));
    baseCtx.strokeRect(canvasP0.x, canvasP0.y, sheetW, sheetH);

    // Fine Grid when zoomed in
    if (vp.zoom >= 8.0) {
      baseCtx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      baseCtx.lineWidth = 1;

      const minWx = Math.max(0, Math.floor(-vp.x / vp.zoom));
      const maxWx = Math.min(CANVAS_WIDTH, Math.ceil((width - vp.x) / vp.zoom));
      const minWy = Math.max(0, Math.floor(-vp.y / vp.zoom));
      const maxWy = Math.min(CANVAS_HEIGHT, Math.ceil((height - vp.y) / vp.zoom));

      baseCtx.beginPath();
      for (let x = minWx; x <= maxWx; x++) {
        const sx = x * vp.zoom + vp.x;
        baseCtx.moveTo(sx, Math.max(canvasP0.y, 0));
        baseCtx.lineTo(sx, Math.min(canvasP1.y, height));
      }
      for (let y = minWy; y <= maxWy; y++) {
        const sy = y * vp.zoom + vp.y;
        baseCtx.moveTo(Math.max(canvasP0.x, 0), sy);
        baseCtx.lineTo(Math.min(canvasP1.x, width), sy);
      }
      baseCtx.stroke();
    }

    // 2. OVERLAY CANVAS RENDER
    overlayCtx.clearRect(0, 0, width, height);

    // Subtle border ONLY when actively hovering over an existing plot
    if (hoveredPlotId && stepRef.current === 'idle') {
      const hoveredPlot = plotsRef.current.find((p) => p.id === hoveredPlotId);
      if (hoveredPlot) {
        const pTopLeft = worldToScreen(hoveredPlot.x, hoveredPlot.y);
        const pBotRight = worldToScreen(hoveredPlot.x + hoveredPlot.width, hoveredPlot.y + hoveredPlot.height);
        const pw = pBotRight.x - pTopLeft.x;
        const ph = pBotRight.y - pTopLeft.y;
        overlayCtx.save();
        overlayCtx.strokeStyle = 'rgba(16, 172, 132, 0.8)';
        overlayCtx.lineWidth = 2;
        overlayCtx.strokeRect(pTopLeft.x, pTopLeft.y, pw, ph);
        overlayCtx.restore();
      }
    }

    // Render Active Selection / Draft Pixels
    const sel = selectionRef.current;
    if (sel && sel.pixelCount > 0) {
      const regionsList =
        sel.regions && sel.regions.length > 0
          ? sel.regions
          : [{ x: sel.x, y: sel.y, width: sel.width, height: sel.height }];

      // 1. Render vibrant blue selection fill over ONLY active selected regions
      overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.32)';
      regionsList.forEach((r) => {
        const p0 = worldToScreen(r.x, r.y);
        const p1 = worldToScreen(r.x + r.width, r.y + r.height);
        overlayCtx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      });

      // 2. Render painted draft pixels on top of selection
      draftPixelsRef.current.forEach((color, key) => {
        if (!color || color === 'transparent') return;
        const [pxStr, pyStr] = key.split(',');
        const px = parseInt(pxStr, 10);
        const py = parseInt(pyStr, 10);

        const screenP = worldToScreen(px, py);
        overlayCtx.fillStyle = color;
        overlayCtx.fillRect(
          Math.floor(screenP.x),
          Math.floor(screenP.y),
          Math.ceil(vp.zoom),
          Math.ceil(vp.zoom)
        );
      });

      // 4. High-contrast selection outline (black outer line + bright blue/cyan marching dash)
      const segments = computeSelectionBoundarySegments(regionsList);
      overlayCtx.save();
      overlayCtx.strokeStyle = '#000000';
      overlayCtx.lineWidth = 3;
      overlayCtx.beginPath();
      segments.forEach((seg) => {
        const s0 = worldToScreen(seg.x1, seg.y1);
        const s1 = worldToScreen(seg.x2, seg.y2);
        overlayCtx.moveTo(s0.x, s0.y);
        overlayCtx.lineTo(s1.x, s1.y);
      });
      overlayCtx.stroke();

      // Bright blue/cyan marching dash inside
      overlayCtx.strokeStyle = '#38BDF8';
      overlayCtx.lineWidth = 2;
      overlayCtx.setLineDash([6, 4]);
      overlayCtx.beginPath();
      segments.forEach((seg) => {
        const s0 = worldToScreen(seg.x1, seg.y1);
        const s1 = worldToScreen(seg.x2, seg.y2);
        overlayCtx.moveTo(s0.x, s0.y);
        overlayCtx.lineTo(s1.x, s1.y);
      });
      overlayCtx.stroke();
      overlayCtx.restore();
    }

    // Render Active Marquee Drag Box Preview (during click/touch drag in Select mode)
    const curBox = activeDragBoxRef.current;
    if (curBox && stepRef.current === 'select') {
      const minX = Math.floor(Math.min(curBox.startX, curBox.currentX));
      const minY = Math.floor(Math.min(curBox.startY, curBox.currentY));
      const maxX = Math.ceil(Math.max(curBox.startX, curBox.currentX));
      const maxY = Math.ceil(Math.max(curBox.startY, curBox.currentY));

      const p0 = worldToScreen(minX, minY);
      const p1 = worldToScreen(maxX, maxY);
      const pw = p1.x - p0.x;
      const ph = p1.y - p0.y;

      if (selectToolRef.current === 'erase') {
        overlayCtx.fillStyle = 'rgba(255, 107, 107, 0.35)';
        overlayCtx.fillRect(p0.x, p0.y, pw, ph);

        overlayCtx.strokeStyle = '#FF4757';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.setLineDash([5, 5]);
        overlayCtx.strokeRect(p0.x, p0.y, pw, ph);
        overlayCtx.setLineDash([]);
      } else {
        // Blue selection drag box
        overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.35)';
        overlayCtx.fillRect(p0.x, p0.y, pw, ph);

        overlayCtx.strokeStyle = '#1D4ED8';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.setLineDash([6, 4]);
        overlayCtx.strokeRect(p0.x, p0.y, pw, ph);
        overlayCtx.setLineDash([]);
      }
    }
  }, [worldToScreen, updateCanvasSizes, hoveredPlotId]);

  useEffect(() => {
    renderCanvases();
  }, [renderCanvases, viewport, plots, selection, draftPixels, step, selectTool, activeDragBox]);

  // Spacebar panning hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sample color for Eyedropper tool
  const sampleColorAt = useCallback(
    (worldX: number, worldY: number) => {
      const px = Math.floor(worldX);
      const py = Math.floor(worldY);
      const key = `${px},${py}`;

      // Check draft pixels first
      if (draftPixelsRef.current.has(key)) {
        const color = draftPixelsRef.current.get(key)!;
        onColorChange(color);
        return;
      }

      // Check master canvas
      const ctx = masterCtxRef.current;
      if (ctx && px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
        const p = ctx.getImageData(px, py, 1, 1).data;
        const hex = rgbToHex(p[0], p[1], p[2]);
        onColorChange(hex);
      }
    },
    [onColorChange]
  );

  // Helper to paint line of pixels smoothly (Bresenham)
  const paintLine = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number, color: string) => {
      const pts = getLinePixels(fromX, fromY, toX, toY);
      pts.forEach((p) => {
        if (selectedPixelSet.current.has(`${p.x},${p.y}`)) {
          onPaintPixel(p.x, p.y, color);
        }
      });
    },
    [onPaintPixel]
  );

  // Finalize selection drag
  const commitSelectionDrag = useCallback(
    (endClientX?: number, endClientY?: number) => {
      if (!isSelectingMarqueeRef.current) return;
      isSelectingMarqueeRef.current = false;
      isMouseDownRef.current = false;

      const curBox = activeDragBoxRef.current;
      setActiveDragBox(null);

      const startW = curBox ? { x: curBox.startX, y: curBox.startY } : { x: 0, y: 0 };
      let endW = curBox ? { x: curBox.currentX, y: curBox.currentY } : startW;

      if (endClientX !== undefined && endClientY !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const vp = viewportRef.current;
        endW = {
          x: (endClientX - rect.left - vp.x) / vp.zoom,
          y: (endClientY - rect.top - vp.y) / vp.zoom,
        };
      }

      const forceAction = selectToolRef.current === 'erase' ? 'remove' : 'add';

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
    },
    [onSelectionChange]
  );

  // Native Non-Passive Wheel & Pinch/Touch Listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Desktop Wheel Zoom
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

    // 2. Multi-Touch & Gesture Listeners for Touch Devices
    const handleNativeTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      if (e.touches.length === 2) {
        // Dual-finger pinch-zoom start
        isPinchingRef.current = true;
        isSelectingMarqueeRef.current = false;
        isPaintingStrokeRef.current = false;
        setActiveDragBox(null);
        setTouchReticle(null);

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        pinchStartDistRef.current = dist;
        pinchStartMidpointRef.current = { x: midX, y: midY };
        pinchStartViewportRef.current = { ...viewportRef.current };
        return;
      }

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const screenX = t.clientX - rect.left;
        const screenY = t.clientY - rect.top;
        const worldPos = screenToWorld(screenX, screenY);
        const px = Math.floor(worldPos.x);
        const py = Math.floor(worldPos.y);

        touchStartScreenRef.current = { x: screenX, y: screenY };
        lastTouchScreenPosRef.current = { x: screenX, y: screenY };
        touchStartTimeRef.current = Date.now();
        hasTouchMovedRef.current = false;
        lastPaintedPixelRef.current = { x: px, y: py };
        mouseWorldPosRef.current = worldPos;

        const currentStep = stepRef.current;
        const currentSelTool = selectToolRef.current;
        const currentPaintTool = paintToolRef.current;

        if (currentStep === 'select' && currentSelTool !== 'pan') {
          isSelectingMarqueeRef.current = true;
          setActiveDragBox({
            startX: worldPos.x,
            startY: worldPos.y,
            currentX: worldPos.x,
            currentY: worldPos.y,
          });
          setTouchReticle({
            screenX,
            screenY,
            worldX: px,
            worldY: py,
            active: true,
          });
        } else if (currentStep === 'paint') {
          if (currentPaintTool === 'brush') {
            isPaintingStrokeRef.current = true;
            if (selectedPixelSet.current.has(`${px},${py}`)) {
              onPaintPixel(px, py, currentColorRef.current);
            }
            setTouchReticle({
              screenX,
              screenY,
              worldX: px,
              worldY: py,
              active: true,
            });
          } else if (currentPaintTool === 'eraser') {
            isPaintingStrokeRef.current = true;
            if (selectedPixelSet.current.has(`${px},${py}`)) {
              onPaintPixel(px, py, '#FAF8F5');
            }
            setTouchReticle({
              screenX,
              screenY,
              worldX: px,
              worldY: py,
              active: true,
            });
          } else if (currentPaintTool === 'eyedropper') {
            sampleColorAt(worldPos.x, worldPos.y);
            setTouchReticle({
              screenX,
              screenY,
              worldX: px,
              worldY: py,
              active: true,
            });
          }
        }
      }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      // Handle 2-finger pinch & pan
      if (e.touches.length === 2 && isPinchingRef.current) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        if (pinchStartDistRef.current > 0) {
          const scaleChange = dist / pinchStartDistRef.current;
          const vp0 = pinchStartViewportRef.current;
          const newZoom = Math.min(32.0, Math.max(0.2, vp0.zoom * scaleChange));

          const originMidX = pinchStartMidpointRef.current.x;
          const originMidY = pinchStartMidpointRef.current.y;

          const worldFocusX = (originMidX - vp0.x) / vp0.zoom;
          const worldFocusY = (originMidY - vp0.y) / vp0.zoom;

          const newX = midX - worldFocusX * newZoom;
          const newY = midY - worldFocusY * newZoom;

          onViewportChange({
            x: newX,
            y: newY,
            zoom: newZoom,
          });
        }
        return;
      }

      // Handle 1-finger gesture
      if (e.touches.length === 1 && !isPinchingRef.current) {
        const t = e.touches[0];
        const screenX = t.clientX - rect.left;
        const screenY = t.clientY - rect.top;
        const worldPos = screenToWorld(screenX, screenY);
        const px = Math.floor(worldPos.x);
        const py = Math.floor(worldPos.y);
        mouseWorldPosRef.current = worldPos;

        const distMoved = Math.hypot(
          screenX - touchStartScreenRef.current.x,
          screenY - touchStartScreenRef.current.y
        );
        if (distMoved >= 6) {
          hasTouchMovedRef.current = true;
        }

        const dx = screenX - lastTouchScreenPosRef.current.x;
        const dy = screenY - lastTouchScreenPosRef.current.y;
        lastTouchScreenPosRef.current = { x: screenX, y: screenY };

        const currentStep = stepRef.current;
        const currentSelTool = selectToolRef.current;
        const currentPaintTool = paintToolRef.current;

        if (
          currentStep === 'idle' ||
          currentStep === 'inspect' ||
          (currentStep === 'select' && currentSelTool === 'pan') ||
          (currentStep === 'paint' && currentPaintTool === 'pan')
        ) {
          // Smooth 1-finger canvas panning on mobile!
          const curVp = viewportRef.current;
          onViewportChange({
            ...curVp,
            x: curVp.x + dx,
            y: curVp.y + dy,
          });
        } else if (currentStep === 'select' && currentSelTool !== 'pan') {
          // Marquee drag selection box update
          setActiveDragBox((prev) =>
            prev
              ? {
                  ...prev,
                  currentX: worldPos.x,
                  currentY: worldPos.y,
                }
              : null
          );
          setTouchReticle({
            screenX,
            screenY,
            worldX: px,
            worldY: py,
            active: true,
          });
        } else if (currentStep === 'paint') {
          if (currentPaintTool === 'brush' && isPaintingStrokeRef.current) {
            const lastPx = lastPaintedPixelRef.current || { x: px, y: py };
            paintLine(lastPx.x, lastPx.y, px, py, currentColorRef.current);
            lastPaintedPixelRef.current = { x: px, y: py };
            setTouchReticle({
              screenX,
              screenY,
              worldX: px,
              worldY: py,
              active: true,
            });
          } else if (currentPaintTool === 'eraser' && isPaintingStrokeRef.current) {
            const lastPx = lastPaintedPixelRef.current || { x: px, y: py };
            paintLine(lastPx.x, lastPx.y, px, py, '#FAF8F5');
            lastPaintedPixelRef.current = { x: px, y: py };
            setTouchReticle({
              screenX,
              screenY,
              worldX: px,
              worldY: py,
              active: true,
            });
          } else if (currentPaintTool === 'eyedropper') {
            sampleColorAt(worldPos.x, worldPos.y);
            setTouchReticle({
              screenX,
              screenY,
              worldX: px,
              worldY: py,
              active: true,
            });
          }
        }
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      setTouchReticle(null);

      if (isPinchingRef.current) {
        if (e.touches.length === 0) {
          isPinchingRef.current = false;
        }
        return;
      }

      const rect = container.getBoundingClientRect();
      const lastScreen = lastTouchScreenPosRef.current;
      const worldPos = screenToWorld(lastScreen.x, lastScreen.y);
      const px = Math.floor(worldPos.x);
      const py = Math.floor(worldPos.y);
      const moved = hasTouchMovedRef.current;
      const duration = Date.now() - touchStartTimeRef.current;

      const currentStep = stepRef.current;
      const currentSelTool = selectToolRef.current;
      const currentPaintTool = paintToolRef.current;

      if (isSelectingMarqueeRef.current) {
        commitSelectionDrag(lastScreen.x + rect.left, lastScreen.y + rect.top);
      }

      isPaintingStrokeRef.current = false;

      // Detect Stationary Tap on Touch Devices (e.g. duration < 350ms and moved < 8px)
      if (!moved && duration < 400) {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;
        const distFromLastTap = Math.hypot(
          lastScreen.x - lastTapPosRef.current.x,
          lastScreen.y - lastTapPosRef.current.y
        );

        // Check Double-Tap to Zoom In / Zoom Out
        if (timeSinceLastTap < 320 && distFromLastTap < 30) {
          lastTapTimeRef.current = 0;
          const curVp = viewportRef.current;
          const targetZoom = curVp.zoom < 3.5 ? 6.0 : 1.0;
          const newX = lastScreen.x - (lastScreen.x - curVp.x) * (targetZoom / curVp.zoom);
          const newY = lastScreen.y - (lastScreen.y - curVp.y) * (targetZoom / curVp.zoom);
          onViewportChange({
            x: newX,
            y: newY,
            zoom: targetZoom,
          });
          return;
        }

        lastTapTimeRef.current = now;
        lastTapPosRef.current = { x: lastScreen.x, y: lastScreen.y };

        // Handle single tap actions by step & tool
        if (currentStep === 'idle' || currentStep === 'inspect') {
          // Check if tapped an owned plot
          const clickedPlot = plotsRef.current.slice().reverse().find(
            (p) =>
              px >= p.x &&
              px < p.x + p.width &&
              py >= p.y &&
              py < p.y + p.height
          );

          if (clickedPlot) {
            onSelectPlot(clickedPlot);
            return;
          }

          // Unowned pixel tap -> Inspect mode & selection
          if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
            onInspectPixel(px, py);
          }
        } else if (currentStep === 'select') {
          if (currentSelTool !== 'pan') {
            const forceAction = currentSelTool === 'erase' ? 'remove' : 'add';
            const newSel = applyDragSelection(
              px,
              py,
              px,
              py,
              plotsRef.current,
              selectionRef.current?.regions || [],
              forceAction
            );
            onSelectionChange(newSel);
          }
        } else if (currentStep === 'paint') {
          if (currentPaintTool === 'bucket') {
            if (selectedPixelSet.current.has(`${px},${py}`)) {
              onFillSelection(currentColorRef.current);
            }
          } else if (currentPaintTool === 'brush') {
            if (selectedPixelSet.current.has(`${px},${py}`)) {
              onPaintPixel(px, py, currentColorRef.current);
            }
          } else if (currentPaintTool === 'eraser') {
            if (selectedPixelSet.current.has(`${px},${py}`)) {
              onPaintPixel(px, py, '#FAF8F5');
            }
          } else if (currentPaintTool === 'eyedropper') {
            sampleColorAt(worldPos.x, worldPos.y);
          }
        }
      }
    };

    const handleNativeTouchCancel = () => {
      isPinchingRef.current = false;
      isSelectingMarqueeRef.current = false;
      isPaintingStrokeRef.current = false;
      setActiveDragBox(null);
      setTouchReticle(null);
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    container.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    container.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    container.addEventListener('touchend', handleNativeTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleNativeTouchCancel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      container.removeEventListener('touchstart', handleNativeTouchStart);
      container.removeEventListener('touchmove', handleNativeTouchMove);
      container.removeEventListener('touchend', handleNativeTouchEnd);
      container.removeEventListener('touchcancel', handleNativeTouchCancel);
    };
  }, [
    onViewportChange,
    screenToWorld,
    sampleColorAt,
    paintLine,
    commitSelectionDrag,
    onSelectPlot,
    onInspectPixel,
    onSelectionChange,
    onPaintPixel,
    onFillSelection,
  ]);

  // Global Pointer Up listener to ensure no stuck drags on desktop
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isSelectingMarqueeRef.current) {
        commitSelectionDrag(e.clientX, e.clientY);
      }
      isMouseDownRef.current = false;
      isDraggingCanvasRef.current = false;
      isPaintingStrokeRef.current = false;
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [commitSelectionDrag]);

  // Mouse Handlers (Desktop Precision)
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    const px = Math.floor(worldPos.x);
    const py = Math.floor(worldPos.y);

    isMouseDownRef.current = true;
    dragStartScreenRef.current = { x: screenX, y: screenY };
    mouseDownPosRef.current = { x: screenX, y: screenY };
    hasMovedSignificantlyRef.current = false;
    lastPaintedPixelRef.current = { x: px, y: py };

    // Spacebar or middle button -> Pan canvas
    if (e.button === 1 || isSpacePressedRef.current) {
      isDraggingCanvasRef.current = true;
      return;
    }

    // Left button logic depends on step & tool
    if (e.button === 0) {
      if (step === 'idle' || step === 'inspect') {
        // Default: hold and drag to pan canvas!
        isDraggingCanvasRef.current = true;
      } else if (step === 'select') {
        if (selectTool === 'pan') {
          isDraggingCanvasRef.current = true;
        } else {
          // Add or Erase marquee drag
          isSelectingMarqueeRef.current = true;
          setActiveDragBox({
            startX: worldPos.x,
            startY: worldPos.y,
            currentX: worldPos.x,
            currentY: worldPos.y,
          });
        }
      } else if (step === 'paint') {
        if (paintTool === 'pan') {
          isDraggingCanvasRef.current = true;
        } else if (paintTool === 'brush') {
          isPaintingStrokeRef.current = true;
          if (selectedPixelSet.current.has(`${px},${py}`)) {
            onPaintPixel(px, py, currentColorRef.current);
          }
        } else if (paintTool === 'eraser') {
          isPaintingStrokeRef.current = true;
          if (selectedPixelSet.current.has(`${px},${py}`)) {
            onPaintPixel(px, py, '#FAF8F5');
          }
        } else if (paintTool === 'bucket') {
          if (selectedPixelSet.current.has(`${px},${py}`)) {
            onFillSelection(currentColorRef.current);
          }
        } else if (paintTool === 'eyedropper') {
          sampleColorAt(worldPos.x, worldPos.y);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    mouseWorldPosRef.current = worldPos;

    if (!isMouseDownRef.current) {
      if (step === 'idle') {
        const px = Math.floor(worldPos.x);
        const py = Math.floor(worldPos.y);
        const hPlot = plots.slice().reverse().find(
          (p) => px >= p.x && px < p.x + p.width && py >= p.y && py < p.y + p.height
        );
        onHoverPlot?.(hPlot ? hPlot.id : null);
      }
      return;
    }

    const distMoved = Math.hypot(
      screenX - mouseDownPosRef.current.x,
      screenY - mouseDownPosRef.current.y
    );
    if (distMoved >= 4) {
      hasMovedSignificantlyRef.current = true;
    }

    const dx = screenX - dragStartScreenRef.current.x;
    const dy = screenY - dragStartScreenRef.current.y;

    if (isDraggingCanvasRef.current || isSpacePressedRef.current || e.buttons === 4) {
      onViewportChange({
        ...viewport,
        x: viewport.x + dx,
        y: viewport.y + dy,
      });
      dragStartScreenRef.current = { x: screenX, y: screenY };
    } else if (isSelectingMarqueeRef.current && activeDragBox) {
      setActiveDragBox({
        ...activeDragBox,
        currentX: worldPos.x,
        currentY: worldPos.y,
      });
    } else if (isPaintingStrokeRef.current) {
      const px = Math.floor(worldPos.x);
      const py = Math.floor(worldPos.y);
      const lastPx = lastPaintedPixelRef.current || { x: px, y: py };
      const color = paintTool === 'eraser' ? '#FAF8F5' : currentColorRef.current;
      paintLine(lastPx.x, lastPx.y, px, py, color);
      lastPaintedPixelRef.current = { x: px, y: py };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    const moved = hasMovedSignificantlyRef.current;

    isMouseDownRef.current = false;
    isDraggingCanvasRef.current = false;
    isPaintingStrokeRef.current = false;

    if (isSelectingMarqueeRef.current) {
      commitSelectionDrag(e.clientX, e.clientY);
      return;
    }

    // Stationary click handling
    if (!moved) {
      const clickedPx = Math.floor(worldPos.x);
      const clickedPy = Math.floor(worldPos.y);

      // Check if clicked an existing owned plot (reverse order for accurate hit-testing)
      const clickedPlot = plots.slice().reverse().find(
        (p) =>
          clickedPx >= p.x &&
          clickedPx < p.x + p.width &&
          clickedPy >= p.y &&
          clickedPy < p.y + p.height
      );

      if (clickedPlot) {
        onSelectPlot(clickedPlot);
        return;
      }

      // Clicked on unowned canvas space
      if (
        clickedPx >= 0 &&
        clickedPx < CANVAS_WIDTH &&
        clickedPy >= 0 &&
        clickedPy < CANVAS_HEIGHT
      ) {
        if (step === 'idle' || step === 'inspect') {
          // Open inspect container at bottom and highlight selected pixel!
          onInspectPixel(clickedPx, clickedPy);
        } else if (step === 'select') {
          // Single click pixel toggle in select mode
          const forceAction = selectTool === 'erase' ? 'remove' : 'add';
          const newSel = applyDragSelection(
            clickedPx,
            clickedPy,
            clickedPx,
            clickedPy,
            plots,
            selection?.regions || [],
            forceAction
          );
          onSelectionChange(newSel);
        }
      }
    }
  };

  // Quick Zoom Functions for On-Screen Touch / Click Controls
  const handleZoomIn = () => {
    const container = containerRef.current;
    if (!container) return;
    const midX = container.clientWidth / 2;
    const midY = container.clientHeight / 2;
    const currentVp = viewportRef.current;
    const newZoom = Math.min(32, currentVp.zoom * 1.5);
    const newX = midX - ((midX - currentVp.x) * newZoom) / currentVp.zoom;
    const newY = midY - ((midY - currentVp.y) * newZoom) / currentVp.zoom;
    onViewportChange({ x: newX, y: newY, zoom: newZoom });
  };

  const handleZoomOut = () => {
    const container = containerRef.current;
    if (!container) return;
    const midX = container.clientWidth / 2;
    const midY = container.clientHeight / 2;
    const currentVp = viewportRef.current;
    const newZoom = Math.max(0.2, currentVp.zoom / 1.5);
    const newX = midX - ((midX - currentVp.x) * newZoom) / currentVp.zoom;
    const newY = midY - ((midY - currentVp.y) * newZoom) / currentVp.zoom;
    onViewportChange({ x: newX, y: newY, zoom: newZoom });
  };

  const handleCenterCanvas = () => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const targetZoom = Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT) * 0.9;
    onViewportChange({
      x: (w - CANVAS_WIDTH * targetZoom) / 2,
      y: (h - CANVAS_HEIGHT * targetZoom) / 2,
      zoom: targetZoom,
    });
  };

  // Normal cursor style (no hand-like grab cursor)
  const getCursorStyle = () => {
    if (step === 'select') {
      return selectTool === 'pan' ? 'cursor-default' : 'cursor-crosshair';
    }
    if (step === 'paint') {
      if (paintTool === 'pan') return 'cursor-default';
      if (paintTool === 'eyedropper') return 'cursor-copy';
      return 'cursor-crosshair';
    }
    return 'cursor-default';
  };

  return (
    <div
      ref={containerRef}
      id="canvas-viewport-container"
      className={`relative w-full h-full overflow-hidden bg-[#ECE7DE] select-none touch-none ${getCursorStyle()}`}
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

      {/* Touch Reticle Magnifier for Mobile Drawing / Selecting Precision */}
      {touchReticle && touchReticle.active && (
        <div
          className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-[130%] bg-black text-white px-2 py-1 rounded-lg border-2 border-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-mono text-[11px] font-bold flex items-center gap-1.5"
          style={{
            left: `${touchReticle.screenX}px`,
            top: `${touchReticle.screenY}px`,
          }}
        >
          <div
            className="w-3 h-3 rounded-full border border-white"
            style={{ backgroundColor: currentColorRef.current }}
          />
          <span>
            {touchReticle.worldX},{touchReticle.worldY}
          </span>
        </div>
      )}

      {/* Auto-Deselect Exclusion Toast Banner if owned pixels were trimmed */}
      {selection?.notificationMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-lg w-11/12 sm:w-auto bg-[#FFE169] border-[2.5px] border-black shadow-[4px_4px_0px_#000] px-4 py-2 rounded-xl flex items-center gap-2.5 text-xs font-black font-mono text-black z-20 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-black shrink-0" />
          <span>{selection.notificationMessage}</span>
        </div>
      )}

      {/* Touch & Desktop Floating Zoom Controls (Top Right) */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-20 select-none">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom In"
          className="w-10 h-10 rounded-xl bg-white hover:bg-gray-50 active:bg-[#FFE169] border-[2.5px] border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center text-black font-black transition-transform"
        >
          <ZoomIn className="w-5 h-5 text-black" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="w-10 h-10 rounded-xl bg-white hover:bg-gray-50 active:bg-[#FFE169] border-[2.5px] border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center text-black font-black transition-transform"
        >
          <ZoomOut className="w-5 h-5 text-black" />
        </button>
        <button
          onClick={handleCenterCanvas}
          title="Fit Canvas"
          aria-label="Fit Canvas"
          className="w-10 h-10 rounded-xl bg-[#FFE169] hover:bg-yellow-300 active:bg-yellow-400 border-[2.5px] border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center text-black font-black transition-transform"
        >
          <Maximize className="w-4 h-4 text-black" />
        </button>
      </div>

      {/* Floating Coordinate HUD in bottom-left */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs border-[2px] border-black shadow-[3px_3px_0px_#000] px-2.5 py-1.5 rounded-xl flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono font-bold pointer-events-none z-10">
        <div>
          <span className="text-gray-500">POS: </span>
          <span className="text-black">
            {Math.min(CANVAS_WIDTH - 1, Math.max(0, Math.floor(mouseWorldPosRef.current.x)))},
            {Math.min(CANVAS_HEIGHT - 1, Math.max(0, Math.floor(mouseWorldPosRef.current.y)))}
          </span>
        </div>
        <div className="text-gray-300">|</div>
        <div>
          <span className="text-gray-500">ZOOM: </span>
          <span className="text-black font-extrabold">{Math.round(viewport.zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
