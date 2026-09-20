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
  rectsOverlap,
  computeSelectionBoundarySegments,
  hexToRgb,
  rgbToHex,
  getSelectionPixelSet,
} from '../lib/canvasUtils';
import { AlertCircle } from 'lucide-react';

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
  const isSpacePressedRef = useRef(false);

  // Active marquee drag preview
  const [activeDragBox, setActiveDragBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const activeDragBoxRef = useRef(activeDragBox);
  activeDragBoxRef.current = activeDragBox;

  // Touch tracking
  const touchStartDistRef = useRef<number | null>(null);

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

  // Resize canvas buffers
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

    // Studio canvas background
    baseCtx.fillStyle = '#ECE7DE';
    baseCtx.fillRect(0, 0, width, height);

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

    // 2. Draw Overlay Layer
    overlayCtx.clearRect(0, 0, width, height);

    // Pixel Grid lines (zoom >= 6x)
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

    // Render Selection & Draft Artwork
    if (selection) {
      const regionsToRender =
        selection.regions && selection.regions.length > 0
          ? selection.regions
          : [
              {
                id: 'primary',
                x: selection.x,
                y: selection.y,
                width: selection.width,
                height: selection.height,
                pixelCount: selection.pixelCount,
                cost: selection.cost,
              },
            ];

      // In Paint mode, render the actual painted pixels on top of selected areas
      if (step === 'paint' && draftPixels.size > 0) {
        draftPixels.forEach((color, key) => {
          const [pxStr, pyStr] = key.split(',');
          const px = parseInt(pxStr, 10);
          const py = parseInt(pyStr, 10);
          const p1 = worldToScreen(px, py);
          const size = Math.max(1, Math.ceil(viewport.zoom));

          overlayCtx.fillStyle = color;
          overlayCtx.fillRect(p1.x, p1.y, size, size);
        });
      } else {
        // In Selection mode, render translucent teal fill over selected regions
        overlayCtx.fillStyle = 'rgba(78, 205, 196, 0.42)';
        regionsToRender.forEach((region) => {
          const p1 = worldToScreen(region.x, region.y);
          const pw = region.width * viewport.zoom;
          const ph = region.height * viewport.zoom;
          overlayCtx.fillRect(p1.x, p1.y, pw, ph);
        });
      }

      // Draw unified perimeter boundary outline
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
    }

    // Active Selection Marquee Drag Box Preview
    if (activeDragBox && step === 'select') {
      const minX = Math.max(0, Math.min(Math.round(activeDragBox.startX), Math.round(activeDragBox.currentX)));
      const maxX = Math.min(CANVAS_WIDTH - 1, Math.max(Math.round(activeDragBox.startX), Math.round(activeDragBox.currentX)));
      const minY = Math.max(0, Math.min(Math.round(activeDragBox.startY), Math.round(activeDragBox.currentY)));
      const maxY = Math.min(CANVAS_HEIGHT - 1, Math.max(Math.round(activeDragBox.startY), Math.round(activeDragBox.currentY)));
      const dw = Math.max(1, maxX - minX + 1);
      const dh = Math.max(1, maxY - minY + 1);

      const isErase = selectTool === 'erase';

      const p1 = worldToScreen(minX, minY);
      const pw = dw * viewport.zoom;
      const ph = dh * viewport.zoom;

      if (isErase) {
        overlayCtx.fillStyle = 'rgba(255, 107, 107, 0.45)';
        overlayCtx.fillRect(p1.x, p1.y, pw, ph);

        overlayCtx.strokeStyle = '#D63031';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.setLineDash([4, 3]);
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);
        overlayCtx.setLineDash([]);
      } else {
        overlayCtx.fillStyle = 'rgba(78, 205, 196, 0.45)';
        overlayCtx.fillRect(p1.x, p1.y, pw, ph);

        overlayCtx.strokeStyle = '#000000';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.setLineDash([6, 4]);
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);
        overlayCtx.setLineDash([]);
      }
    }
  }, [viewport, plots, selection, draftPixels, step, selectTool, hoveredPlotId, activeDragBox, worldToScreen]);

  useEffect(() => {
    renderCanvases();
  }, [renderCanvases]);

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

  // Native non-passive listeners for zoom and smooth touch
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [onViewportChange]);

  // Sample color for Eyedropper tool
  const sampleColorAt = (worldX: number, worldY: number) => {
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
  };

  // Finalize selection drag
  const commitSelectionDrag = (endClientX?: number, endClientY?: number) => {
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
  };

  // Global Pointer Up listener to ensure no stuck drags
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
  }, []);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    isMouseDownRef.current = true;
    dragStartScreenRef.current = { x: screenX, y: screenY };
    mouseDownPosRef.current = { x: screenX, y: screenY };
    hasMovedSignificantlyRef.current = false;

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
          const px = Math.floor(worldPos.x);
          const py = Math.floor(worldPos.y);
          if (selectedPixelSet.current.has(`${px},${py}`)) {
            onPaintPixel(px, py, currentColorRef.current);
          }
        } else if (paintTool === 'eraser') {
          isPaintingStrokeRef.current = true;
          const px = Math.floor(worldPos.x);
          const py = Math.floor(worldPos.y);
          if (selectedPixelSet.current.has(`${px},${py}`)) {
            onPaintPixel(px, py, '#FAF8F5');
          }
        } else if (paintTool === 'bucket') {
          const px = Math.floor(worldPos.x);
          const py = Math.floor(worldPos.y);
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

    if (!isMouseDownRef.current) return;

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
      if (selectedPixelSet.current.has(`${px},${py}`)) {
        const color = paintTool === 'eraser' ? '#FAF8F5' : currentColorRef.current;
        onPaintPixel(px, py, color);
      }
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

      // Check if clicked an existing owned plot
      const clickedPlot = plots.find(
        (p) =>
          worldPos.x >= p.x &&
          worldPos.x < p.x + p.width &&
          worldPos.y >= p.y &&
          worldPos.y < p.y + p.height
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
          // Open inspect container at bottom!
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

  // Cursor style calculation
  const getCursorStyle = () => {
    if (isSpacePressedRef.current || isDraggingCanvasRef.current) {
      return 'cursor-grab active:cursor-grabbing';
    }
    if (step === 'idle' || step === 'inspect') {
      return 'cursor-grab active:cursor-grabbing';
    }
    if (step === 'select') {
      return selectTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair';
    }
    if (step === 'paint') {
      if (paintTool === 'pan') return 'cursor-grab active:cursor-grabbing';
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
          <span className="text-gray-500">CANVAS: </span>
          <span className="text-black">1000×1000</span>
        </div>
      </div>
    </div>
  );
};
