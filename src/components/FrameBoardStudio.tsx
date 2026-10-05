import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PixelSelection, SelectTool, PaintTool } from '../types';
import { NEO_BRUTALIST_PALETTE, PRICE_PER_PIXEL, processImageForPlotFrame } from '../lib/canvasUtils';
import {
  Paintbrush,
  Eraser,
  PaintBucket,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  Check,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Maximize2,
  Minimize2,
  ZoomIn,
  Type,
  Smile,
} from 'lucide-react';

interface FrameBoardStudioProps {
  selection: PixelSelection;
  draftImageUrl: string | null;
  onUpdateArtwork: (imageUrl: string, draftPixels: Map<string, string>) => void;
  onClose: () => void;
  onProceedToCheckout: () => void;
  onBackToSelect: () => void;
}

export const FrameBoardStudio: React.FC<FrameBoardStudioProps> = ({
  selection,
  draftImageUrl,
  onUpdateArtwork,
  onClose,
  onProceedToCheckout,
  onBackToSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drawing tools
  const [tool, setTool] = useState<'brush' | 'eraser' | 'bucket'>('brush');
  const [color, setColor] = useState<string>('#FF6B6B');
  const [brushSize, setBrushSize] = useState<number>(8);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Undo history stack
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Bounding dimensions of the selection
  const regions =
    selection.regions && selection.regions.length > 0
      ? selection.regions
      : [
          {
            id: '1',
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height,
            pixelCount: selection.pixelCount,
            cost: selection.cost,
          },
        ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  regions.forEach((r) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  });

  const bboxW = Math.max(1, maxX - minX);
  const bboxH = Math.max(1, maxY - minY);

  // Canvas internal resolution (crisp board)
  const maxDimension = 640;
  const boardWidth = bboxW >= bboxH ? maxDimension : Math.max(180, Math.round((bboxW / bboxH) * maxDimension));
  const boardHeight = bboxH >= bboxW ? maxDimension : Math.max(180, Math.round((bboxH / bboxW) * maxDimension));

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Save current canvas state to history and sync with main app
  const syncArtworkToApp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const highResUrl = canvas.toDataURL('image/png', 0.92);

    // Also generate low-res fallback pixel map
    const lowRes = document.createElement('canvas');
    lowRes.width = bboxW;
    lowRes.height = bboxH;
    const lCtx = lowRes.getContext('2d');
    const pixelMap = new Map<string, string>();

    if (lCtx) {
      lCtx.imageSmoothingEnabled = true;
      lCtx.drawImage(canvas, 0, 0, bboxW, bboxH);
      const imgData = lCtx.getImageData(0, 0, bboxW, bboxH).data;

      for (let py = 0; py < bboxH; py++) {
        for (let px = 0; px < bboxW; px++) {
          const idx = (py * bboxW + px) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const a = imgData[idx + 3];

          const key = `${minX + px},${minY + py}`;
          if (a > 30) {
            const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            pixelMap.set(key, hex);
          } else {
            pixelMap.set(key, '#FAF8F5');
          }
        }
      }
    }

    onUpdateArtwork(highResUrl, pixelMap);
  }, [bboxW, bboxH, minX, minY, onUpdateArtwork]);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      return [...next, data].slice(-20); // Keep max 20 undo steps
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 19));
  }, [historyIndex]);

  // Initial setup of the board canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = boardWidth;
    canvas.height = boardHeight;

    if (draftImageUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, boardWidth, boardHeight);
        ctx.drawImage(img, 0, 0, boardWidth, boardHeight);
        pushHistory();
      };
      img.src = draftImageUrl;
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, boardWidth, boardHeight);
      pushHistory();
      syncArtworkToApp();
    }
  }, [boardWidth, boardHeight]);

  // Handle Undo
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const targetIdx = historyIndex - 1;
    const prevData = history[targetIdx];
    const canvas = canvasRef.current;
    if (!canvas || !prevData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(prevData, 0, 0);
    setHistoryIndex(targetIdx);
    syncArtworkToApp();
  };

  // Clear Board to white
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
    syncArtworkToApp();
  };

  // Bucket Fill
  const handleBucketFill = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
    syncArtworkToApp();
  };

  // Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await processImageForPlotFrame(file, selection);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        pushHistory();
        syncArtworkToApp();
      };
      img.src = res.imageUrl;
    } catch (err) {
      console.error('Failed to load image to frame board:', err);
    }
    e.target.value = '';
  };

  // Coordinate mapping from client mouse/touch to high-res canvas space
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (tool === 'bucket') {
      handleBucketFill();
      return;
    }

    const pos = getCanvasCoords(e);
    lastPosRef.current = pos;
    setIsDrawing(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.fillStyle = tool === 'eraser' ? '#FFFFFF' : color;

    // Dot at tap point
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasCoords(e);
    const lastPos = lastPosRef.current || pos;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    // Smooth quadratic curve midpoint
    const midX = (lastPos.x + pos.x) / 2;
    const midY = (lastPos.y + pos.y) / 2;
    ctx.quadraticCurveTo(lastPos.x, lastPos.y, midX, midY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPosRef.current = pos;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPosRef.current = null;
    pushHistory();
    syncArtworkToApp();
  };

  const totalCost = selection.pixelCount * PRICE_PER_PIXEL;

  return (
    <div
      id="frame-board-studio-wrapper"
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto select-none"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[95vh] animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-3 sm:p-4 bg-[#ECE7DE] border-b-[2.5px] border-black flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE169] border-[2px] border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black font-mono text-black uppercase">
                  {selection.pixelCount === 1 ? '1×1 Pixel Frame Board' : `${bboxW}×${bboxH} Frame Board`}
                </span>
                <span className="bg-black text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                  {selection.pixelCount.toLocaleString()} px
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-600 font-medium">
                Draw or insert any image at 100% original quality
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="bg-white px-2.5 py-1 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_#000] text-xs font-black font-mono text-[#10AC84]">
              ${totalCost.toFixed(2)}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl border-[2px] border-black bg-white hover:bg-gray-100 flex items-center justify-center text-black active:translate-y-0.5"
              title="Close Board"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Canvas Drawing Area */}
        <div className="p-3 sm:p-5 flex flex-col items-center justify-center bg-[#E5DFD3]/40 overflow-y-auto flex-1">
          {/* Framed Canvas Stage */}
          <div className="relative border-[3px] border-black shadow-[5px_5px_0px_#000] bg-white rounded-lg overflow-hidden flex items-center justify-center max-w-full touch-none">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                width: '100%',
                maxWidth: bboxW >= bboxH ? '420px' : `${Math.round((bboxW / bboxH) * 420)}px`,
                aspectRatio: `${bboxW} / ${bboxH}`,
                cursor: tool === 'eraser' ? 'crosshair' : tool === 'bucket' ? 'cell' : 'crosshair',
              }}
              className="bg-white block select-none"
            />
          </div>

          <div className="text-[11px] font-mono text-gray-500 font-bold mt-2 text-center">
            {selection.pixelCount === 1
              ? '1 Pixel Frame — sharp & high-res at any zoom level'
              : `${bboxW}×${bboxH} Matrix Frame — high-fidelity vector & image board`}
          </div>
        </div>

        {/* Tools and Controls Toolbar */}
        <div className="p-3 sm:p-4 bg-[#FAF8F5] border-t-[2.5px] border-black flex flex-col gap-3">
          {/* Tool Selector + Brush Sizes + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Draw Tools */}
            <div className="flex items-center gap-1 bg-[#ECE7DE] p-1 rounded-xl border-[2px] border-black">
              <button
                onClick={() => setTool('brush')}
                className={`p-2 rounded-lg border-[1.5px] min-h-[36px] min-w-[36px] flex items-center justify-center transition-all ${
                  tool === 'brush'
                    ? 'bg-[#FFE169] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Brush"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded-lg border-[1.5px] min-h-[36px] min-w-[36px] flex items-center justify-center transition-all ${
                  tool === 'eraser'
                    ? 'bg-[#FF7675] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('bucket')}
                className={`p-2 rounded-lg border-[1.5px] min-h-[36px] min-w-[36px] flex items-center justify-center transition-all ${
                  tool === 'bucket'
                    ? 'bg-[#4ECDC4] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Fill Board with Color"
              >
                <PaintBucket className="w-4 h-4" />
              </button>
            </div>

            {/* Brush Sizes */}
            {tool !== 'bucket' && (
              <div className="flex items-center gap-1.5 bg-[#ECE7DE] px-2 py-1 rounded-xl border-[2px] border-black">
                <span className="text-[10px] font-mono font-bold text-gray-600">SIZE:</span>
                {[3, 8, 16, 32].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setBrushSize(sz)}
                    className={`w-7 h-7 rounded-lg border-[1.5px] flex items-center justify-center text-xs font-mono font-black transition-all ${
                      brushSize === sz
                        ? 'bg-black text-white border-black shadow-[1px_1px_0px_#FFE169]'
                        : 'bg-white text-black border-black hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className="rounded-full bg-current"
                      style={{ width: Math.max(3, sz / 2.5), height: Math.max(3, sz / 2.5) }}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Insert Image Button */}
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl border-[2px] border-black bg-[#54A0FF] hover:bg-[#2E86DE] text-black font-black text-xs font-mono shadow-[2px_2px_0px_#000] flex items-center gap-1.5 active:translate-y-0.5"
                title="Insert full original quality image"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Insert Image</span>
              </button>

              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-2 rounded-xl border-[2px] border-black bg-white hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-black"
                title="Undo Stroke"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleClear}
                className="p-2 rounded-xl border-[2px] border-black bg-white hover:bg-red-50 text-red-600 flex items-center justify-center"
                title="Clear Board"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Color Palette Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full touch-pan-x">
            <div className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_#000]">
              <div
                className="w-6 h-6 rounded-lg border-[2px] border-black shrink-0 relative overflow-hidden"
                style={{ backgroundColor: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </div>
              <span className="text-[11px] font-mono font-black text-black">{color}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pr-2">
              {NEO_BRUTALIST_PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  onClick={() => setColor(swatch)}
                  className={`w-7 h-7 rounded-lg border-[2px] transition-transform shrink-0 ${
                    color.toLowerCase() === swatch.toLowerCase()
                      ? 'border-black scale-110 shadow-[2px_2px_0px_#000] z-10'
                      : 'border-black/50 hover:scale-105 active:scale-95'
                  }`}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-3 gap-2">
            <button
              onClick={onBackToSelect}
              className="px-3 sm:px-4 py-2 rounded-xl border-[2px] border-black bg-white hover:bg-gray-100 text-black text-xs font-mono font-bold flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Selection</span>
            </button>

            <button
              onClick={onProceedToCheckout}
              className="px-4 sm:px-6 py-2.5 rounded-xl border-[2.5px] border-black bg-[#1DD1A1] hover:bg-[#10AC84] text-black font-black text-xs sm:text-sm font-mono shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>Continue to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
