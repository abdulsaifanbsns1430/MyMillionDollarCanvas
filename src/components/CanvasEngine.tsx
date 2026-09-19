import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Plot, PixelSelection, ViewportState } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  evaluateSelection,
  PRICE_PER_PIXEL,
  hexToRgb,
} from '../lib/canvasUtils';

interface CanvasEngineProps {
  plots: Plot[];
  mode: 'pan' | 'select';
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

  // In-memory offscreen master canvas for 2000x2000 pixel raster
  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const masterCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Interaction tracking state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseWorldPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);

  // Mobile pinch-zoom tracking
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize master 2000x2000 canvas in memory
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

    // Subtle 100x100 grid markers on base
    ctx.strokeStyle = '#EFE9DF';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Paint all plots
    plots.forEach((plot) => {
      // Use direct imageData injection or fillRect for each pixel
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
        // Fallback color block
        ctx.fillStyle = '#4ECDC4';
        ctx.fillRect(plot.x, plot.y, plot.width, plot.height);
      }

      // Plot border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(plot.x + 0.5, plot.y + 0.5, plot.width, plot.height);
    });

    // Trigger render
    requestRender();
  }, [plots]);

  // Coordinate conversion helpers
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      return {
        x: (screenX - viewport.x) / viewport.zoom,
        y: (screenY - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      return {
        x: worldX * viewport.zoom + viewport.x,
        y: worldY * viewport.zoom + viewport.y,
      };
    },
    [viewport]
  );

  // Main Render Loop (Viewport Culling & Sharp Pixel Rendering)
  const requestRender = useCallback(() => {
    const baseCanvas = baseCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const masterCanvas = masterCanvasRef.current;
    if (!baseCanvas || !overlayCanvas || !masterCanvas) return;

    const baseCtx = baseCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!baseCtx || !overlayCtx) return;

    const width = baseCanvas.width;
    const height = baseCanvas.height;

    // 1. Draw Master Canvas into Viewport with Culling
    baseCtx.clearRect(0, 0, width, height);
    baseCtx.imageSmoothingEnabled = false; // preserve pixelated look

    // Calculate source rect in master canvas
    const srcX = Math.max(0, -viewport.x / viewport.zoom);
    const srcY = Math.max(0, -viewport.y / viewport.zoom);
    const srcW = Math.min(CANVAS_WIDTH - srcX, width / viewport.zoom);
    const srcH = Math.min(CANVAS_HEIGHT - srcY, height / viewport.zoom);

    // Destination rect on screen
    const dstX = srcX * viewport.zoom + viewport.x;
    const dstY = srcY * viewport.zoom + viewport.y;
    const dstW = srcW * viewport.zoom;
    const dstH = srcH * viewport.zoom;

    if (srcW > 0 && srcH > 0) {
      baseCtx.drawImage(masterCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
    }

    // Outer boundary of 2000x2000 world
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

    // 2. Draw Overlay Layer (Grid, Hover, Selection Marquee)
    overlayCtx.clearRect(0, 0, width, height);

    // Render pixel grid lines when zoomed in sufficiently (> 6x)
    if (viewport.zoom >= 6) {
      overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
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
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);

        overlayCtx.strokeStyle = '#000000';
        overlayCtx.lineWidth = 1;
        overlayCtx.strokeRect(p1.x, p1.y, pw, ph);
      }
    }

    // Render active selection bounding box
    if (selection) {
      const p1 = worldToScreen(selection.x, selection.y);
      const pw = selection.width * viewport.zoom;
      const ph = selection.height * viewport.zoom;

      // Fill transparent overlay
      overlayCtx.fillStyle = selection.hasCollision
        ? 'rgba(255, 107, 107, 0.35)'
        : 'rgba(78, 205, 196, 0.35)';
      overlayCtx.fillRect(p1.x, p1.y, pw, ph);

      // Dash border
      overlayCtx.strokeStyle = selection.hasCollision ? '#FF6B6B' : '#000000';
      overlayCtx.lineWidth = 2.5;
      overlayCtx.setLineDash([6, 4]);
      overlayCtx.strokeRect(p1.x, p1.y, pw, ph);
      overlayCtx.setLineDash([]); // reset

      // Neo-brutalist info tag floating at selection top-right
      const tagText = `${selection.width}×${selection.height} = ${selection.pixelCount} px ($${selection.cost.toFixed(2)})`;
      overlayCtx.font = 'bold 12px monospace';
      const textMetrics = overlayCtx.measureText(tagText);
      const tagW = textMetrics.width + 16;
      const tagH = 24;
      const tagX = Math.min(width - tagW - 10, Math.max(10, p1.x));
      const tagY = Math.max(10, p1.y - tagH - 6);

      // Tag Shadow & Box
      overlayCtx.fillStyle = '#000000';
      overlayCtx.fillRect(tagX + 3, tagY + 3, tagW, tagH);

      overlayCtx.fillStyle = selection.hasCollision ? '#FF6B6B' : '#FFE169';
      overlayCtx.fillRect(tagX, tagY, tagW, tagH);

      overlayCtx.strokeStyle = '#000000';
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(tagX, tagY, tagW, tagH);

      // Tag Text
      overlayCtx.fillStyle = '#000000';
      overlayCtx.fillText(tagText, tagX + 8, tagY + 16);
    }
  }, [viewport, plots, selection, hoveredPlotId, worldToScreen]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;
      const { clientWidth, clientHeight } = container;

      if (baseCanvasRef.current) {
        baseCanvasRef.current.width = clientWidth;
        baseCanvasRef.current.height = clientHeight;
      }
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = clientWidth;
        overlayCanvasRef.current.height = clientHeight;
      }

      requestRender();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [requestRender]);

  // Re-render when viewport or selection changes
  useEffect(() => {
    requestRender();
  }, [requestRender]);

  // Keyboard spacebar listener for quick pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressedRef.current) {
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

  // Mouse wheel zoom centered at cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom multiplier
    const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
    const newZoom = Math.min(32, Math.max(0.2, viewport.zoom * zoomFactor));

    // Calculate new viewport position to zoom towards cursor
    const newX = mouseX - ((mouseX - viewport.x) * newZoom) / viewport.zoom;
    const newY = mouseY - ((mouseY - viewport.y) * newZoom) / viewport.zoom;

    onViewportChange({
      x: newX,
      y: newY,
      zoom: newZoom,
    });
  };

  // Mouse Down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    isDraggingRef.current = true;
    dragStartRef.current = { x: screenX, y: screenY };

    // Pan condition: middle mouse, spacebar, or pan mode
    if (e.button === 1 || isSpacePressedRef.current || mode === 'pan') {
      // Pan initiated
      return;
    }

    if (e.button === 0 && mode === 'select') {
      // Check if clicked directly on an existing plot first
      const clickedPlot = plots.find(
        (p) =>
          worldPos.x >= p.x &&
          worldPos.x < p.x + p.width &&
          worldPos.y >= p.y &&
          worldPos.y < p.y + p.height
      );

      // Start drag selection
      const initialSel = evaluateSelection(worldPos.x, worldPos.y, worldPos.x, worldPos.y, plots);
      onSelectionChange(initialSel);
    }
  };

  // Mouse Move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    mouseWorldPosRef.current = worldPos;

    if (!isDraggingRef.current) return;

    const dx = screenX - dragStartRef.current.x;
    const dy = screenY - dragStartRef.current.y;

    if (e.buttons === 4 || isSpacePressedRef.current || mode === 'pan') {
      // Panning canvas
      onViewportChange({
        ...viewport,
        x: viewport.x + dx,
        y: viewport.y + dy,
      });
      dragStartRef.current = { x: screenX, y: screenY };
    } else if (mode === 'select' && selection) {
      // Updating selection box
      const updatedSel = evaluateSelection(
        selection.startX,
        selection.startY,
        worldPos.x,
        worldPos.y,
        plots
      );
      onSelectionChange(updatedSel);
    }
  };

  // Mouse Up handler
  const handleMouseUp = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const totalDragDist = Math.hypot(
      screenX - dragStartRef.current.x,
      screenY - dragStartRef.current.y
    );

    isDraggingRef.current = false;

    // If click had minimal movement (e.g. < 5px), treat as a click to inspect plot
    if (totalDragDist < 5) {
      const worldPos = screenToWorld(screenX, screenY);
      const clickedPlot = plots.find(
        (p) =>
          worldPos.x >= p.x &&
          worldPos.x < p.x + p.width &&
          worldPos.y >= p.y &&
          worldPos.y < p.y + p.height
      );

      if (clickedPlot) {
        onSelectPlot(clickedPlot);
        onSelectionChange(null);
      }
    }
  };

  // Touch Handlers for Mobile Pan, Pinch-Zoom & Selection
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = touch.clientX - rect.left;
      const screenY = touch.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

      isDraggingRef.current = true;
      dragStartRef.current = { x: screenX, y: screenY };

      if (mode === 'select') {
        const initialSel = evaluateSelection(
          worldPos.x,
          worldPos.y,
          worldPos.x,
          worldPos.y,
          plots
        );
        onSelectionChange(initialSel);
      }
    } else if (e.touches.length === 2) {
      // Pinch zoom start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartDistRef.current = dist;
      touchStartCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = touch.clientX - rect.left;
      const screenY = touch.clientY - rect.top;
      const dx = screenX - dragStartRef.current.x;
      const dy = screenY - dragStartRef.current.y;

      if (mode === 'pan') {
        onViewportChange({
          ...viewport,
          x: viewport.x + dx,
          y: viewport.y + dy,
        });
        dragStartRef.current = { x: screenX, y: screenY };
      } else if (mode === 'select' && selection) {
        const worldPos = screenToWorld(screenX, screenY);
        const updatedSel = evaluateSelection(
          selection.startX,
          selection.startY,
          worldPos.x,
          worldPos.y,
          plots
        );
        onSelectionChange(updatedSel);
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current && touchStartCenterRef.current) {
      // Handle pinch zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartDistRef.current;

      const newZoom = Math.min(32, Math.max(0.2, viewport.zoom * ratio));
      touchStartDistRef.current = dist;

      onViewportChange({
        ...viewport,
        zoom: newZoom,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    isDraggingRef.current = false;
    touchStartDistRef.current = null;
    touchStartCenterRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      id="canvas-viewport-container"
      className={`relative w-full h-full overflow-hidden bg-[#FAF8F5] select-none ${
        mode === 'pan' || isSpacePressedRef.current ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Base Canvas */}
      <canvas ref={baseCanvasRef} className="absolute inset-0 block w-full h-full pointer-events-none" />

      {/* Interactive Overlay Canvas */}
      <canvas ref={overlayCanvasRef} className="absolute inset-0 block w-full h-full pointer-events-none" />

      {/* Floating Coordinate HUD in bottom-left */}
      <div className="absolute bottom-4 left-4 bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] px-3 py-1.5 rounded-xl flex items-center gap-3 text-xs font-mono font-bold pointer-events-none z-10">
        <div>
          <span className="text-gray-500">POS: </span>
          <span className="text-black">
            X:{Math.min(1999, Math.max(0, Math.floor(mouseWorldPosRef.current.x)))}, Y:
            {Math.min(1999, Math.max(0, Math.floor(mouseWorldPosRef.current.y)))}
          </span>
        </div>
        <div className="text-gray-300">|</div>
        <div>
          <span className="text-gray-500">ZOOM: </span>
          <span className="text-black">{Math.round(viewport.zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
