import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Paintbrush,
  Eraser,
  Pipette,
  PaintBucket,
  Undo2,
  Redo2,
  Upload,
  Save,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Plot } from '../types';
import {
  NEO_BRUTALIST_PALETTE,
  processImageToPixels,
} from '../lib/canvasUtils';

interface PaintStudioModalProps {
  plot: Plot;
  onClose: () => void;
  onSave: (
    plotId: string,
    pixels: string[],
    title: string,
    note: string,
    linkUrl?: string
  ) => Promise<void>;
}

export const PaintStudioModal: React.FC<PaintStudioModalProps> = ({
  plot,
  onClose,
  onSave,
}) => {
  const [pixels, setPixels] = useState<string[]>(
    plot.pixels && plot.pixels.length === plot.width * plot.height
      ? [...plot.pixels]
      : new Array(plot.width * plot.height).fill('#FFE169')
  );

  // Undo / Redo history
  const [history, setHistory] = useState<string[][]>([[...pixels]]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Painting tools
  const [selectedTool, setSelectedTool] = useState<'pencil' | 'bucket' | 'eraser' | 'dropper'>('pencil');
  const [selectedColor, setSelectedColor] = useState<string>('#FF6B6B');
  const [customHex, setCustomHex] = useState<string>('#FF6B6B');

  // Metadata
  const [title, setTitle] = useState(plot.title || '');
  const [note, setNote] = useState(plot.note || '');
  const [linkUrl, setLinkUrl] = useState(plot.linkUrl || '');

  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Canvas ref for visual editor
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef(false);

  // Pixel cell size on editor screen
  const maxEditorDim = 320;
  const cellSize = Math.max(8, Math.min(32, Math.floor(maxEditorDim / Math.max(plot.width, plot.height))));
  const editorWidth = plot.width * cellSize;
  const editorHeight = plot.height * cellSize;

  // Render pixels to editor canvas
  const renderEditor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, editorWidth, editorHeight);

    for (let y = 0; y < plot.height; y++) {
      for (let x = 0; x < plot.width; x++) {
        const idx = y * plot.width + x;
        const color = pixels[idx] || '#FAF8F5';

        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

        // Pixel grid line
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }, [pixels, plot.width, plot.height, cellSize, editorWidth, editorHeight]);

  useEffect(() => {
    renderEditor();
  }, [renderEditor]);

  // Push new state to history
  const pushState = (newPixels: string[]) => {
    const sliced = history.slice(0, historyIdx + 1);
    sliced.push([...newPixels]);
    setHistory(sliced);
    setHistoryIdx(sliced.length - 1);
    setPixels(newPixels);
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      const nextIdx = historyIdx - 1;
      setHistoryIdx(nextIdx);
      setPixels([...history[nextIdx]]);
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const nextIdx = historyIdx + 1;
      setHistoryIdx(nextIdx);
      setPixels([...history[nextIdx]]);
    }
  };

  // Pixel manipulation
  const applyPixelAction = (px: number, py: number) => {
    if (px < 0 || px >= plot.width || py < 0 || py >= plot.height) return;
    const targetIdx = py * plot.width + px;

    if (selectedTool === 'dropper') {
      const picked = pixels[targetIdx] || '#FAF8F5';
      setSelectedColor(picked);
      setCustomHex(picked);
      setSelectedTool('pencil');
      return;
    }

    if (selectedTool === 'pencil') {
      if (pixels[targetIdx] === selectedColor) return;
      const updated = [...pixels];
      updated[targetIdx] = selectedColor;
      pushState(updated);
    } else if (selectedTool === 'eraser') {
      if (pixels[targetIdx] === '#FAF8F5') return;
      const updated = [...pixels];
      updated[targetIdx] = '#FAF8F5';
      pushState(updated);
    } else if (selectedTool === 'bucket') {
      const targetColor = pixels[targetIdx];
      if (targetColor === selectedColor) return;

      // Flood fill BFS
      const updated = [...pixels];
      const queue: [number, number][] = [[px, py]];
      const visited = new Uint8Array(plot.width * plot.height);

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        const cIdx = cy * plot.width + cx;
        if (visited[cIdx]) continue;
        visited[cIdx] = 1;

        if (updated[cIdx] === targetColor) {
          updated[cIdx] = selectedColor;

          if (cx > 0) queue.push([cx - 1, cy]);
          if (cx < plot.width - 1) queue.push([cx + 1, cy]);
          if (cy > 0) queue.push([cx, cy - 1]);
          if (cy < plot.height - 1) queue.push([cx, cy + 1]);
        }
      }
      pushState(updated);
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { px: -1, py: -1 };
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const px = Math.floor(cx / cellSize);
    const py = Math.floor(cy / cellSize);
    return { px, py };
  };

  const getTouchCanvasCoords = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return { px: -1, py: -1 };
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches[0].clientX - rect.left;
    const cy = e.touches[0].clientY - rect.top;
    const px = Math.floor(cx / cellSize);
    const py = Math.floor(cy / cellSize);
    return { px, py };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPaintingRef.current = true;
    const { px, py } = getCanvasCoords(e);
    applyPixelAction(px, py);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintingRef.current) return;
    if (selectedTool !== 'pencil' && selectedTool !== 'eraser') return;
    const { px, py } = getCanvasCoords(e);
    if (px < 0 || px >= plot.width || py < 0 || py >= plot.height) return;

    const targetIdx = py * plot.width + px;
    const drawColor = selectedTool === 'eraser' ? '#FAF8F5' : selectedColor;
    if (pixels[targetIdx] !== drawColor) {
      const updated = [...pixels];
      updated[targetIdx] = drawColor;
      setPixels(updated);
    }
  };

  const handleMouseUp = () => {
    if (isPaintingRef.current) {
      isPaintingRef.current = false;
      // Commit state after continuous drag
      pushState(pixels);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isPaintingRef.current = true;
    const { px, py } = getTouchCanvasCoords(e);
    applyPixelAction(px, py);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isPaintingRef.current) return;
    if (selectedTool !== 'pencil' && selectedTool !== 'eraser') return;
    const { px, py } = getTouchCanvasCoords(e);
    if (px < 0 || px >= plot.width || py < 0 || py >= plot.height) return;

    const targetIdx = py * plot.width + px;
    const drawColor = selectedTool === 'eraser' ? '#FAF8F5' : selectedColor;
    if (pixels[targetIdx] !== drawColor) {
      const updated = [...pixels];
      updated[targetIdx] = drawColor;
      setPixels(updated);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (isPaintingRef.current) {
      isPaintingRef.current = false;
      pushState(pixels);
    }
  };

  // Image to Pixel Art upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImg(true);
    try {
      const convertedPixels = await processImageToPixels(file, plot.width, plot.height);
      pushState(convertedPixels);
    } catch (err) {
      console.error('Failed to convert image to pixel art:', err);
    } finally {
      setIsProcessingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(plot.id, pixels, title, note, linkUrl);
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="paint-studio-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-2xl w-full p-4 sm:p-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#4ECDC4] border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-xl">
              <Paintbrush className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black">
                PIXEL ART STUDIO
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                Editing plot {plot.width}×{plot.height} ({plot.pixelCount} px) at ({plot.x}, {plot.y})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-black hover:bg-black/10 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Left Column: Canvas Preview */}
          <div className="md:col-span-7 flex flex-col items-center">
            {/* Action Bar (Tools & Undo) */}
            <div className="w-full flex items-center justify-between gap-1 mb-2 bg-white border-[2px] border-black p-1.5 rounded-xl">
              <div className="flex items-center gap-1">
                {/* Pencil */}
                <button
                  type="button"
                  onClick={() => setSelectedTool('pencil')}
                  title="Pencil (1px)"
                  className={`p-1.5 rounded-lg border border-black font-bold transition-transform ${
                    selectedTool === 'pencil' ? 'bg-[#FFE169] shadow-[1px_1px_0px_#000]' : 'bg-gray-50'
                  }`}
                >
                  <Paintbrush className="w-4 h-4 text-black" />
                </button>

                {/* Flood Fill */}
                <button
                  type="button"
                  onClick={() => setSelectedTool('bucket')}
                  title="Flood Fill"
                  className={`p-1.5 rounded-lg border border-black font-bold transition-transform ${
                    selectedTool === 'bucket' ? 'bg-[#FFE169] shadow-[1px_1px_0px_#000]' : 'bg-gray-50'
                  }`}
                >
                  <PaintBucket className="w-4 h-4 text-black" />
                </button>

                {/* Eraser */}
                <button
                  type="button"
                  onClick={() => setSelectedTool('eraser')}
                  title="Eraser"
                  className={`p-1.5 rounded-lg border border-black font-bold transition-transform ${
                    selectedTool === 'eraser' ? 'bg-[#FFE169] shadow-[1px_1px_0px_#000]' : 'bg-gray-50'
                  }`}
                >
                  <Eraser className="w-4 h-4 text-black" />
                </button>

                {/* Eyedropper */}
                <button
                  type="button"
                  onClick={() => setSelectedTool('dropper')}
                  title="Eyedropper Color Picker"
                  className={`p-1.5 rounded-lg border border-black font-bold transition-transform ${
                    selectedTool === 'dropper' ? 'bg-[#FFE169] shadow-[1px_1px_0px_#000]' : 'bg-gray-50'
                  }`}
                >
                  <Pipette className="w-4 h-4 text-black" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                {/* Undo */}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIdx <= 0}
                  title="Undo"
                  className="p-1.5 rounded-lg border border-black disabled:opacity-30 bg-gray-50 hover:bg-gray-100"
                >
                  <Undo2 className="w-4 h-4 text-black" />
                </button>

                {/* Redo */}
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyIdx >= history.length - 1}
                  title="Redo"
                  className="p-1.5 rounded-lg border border-black disabled:opacity-30 bg-gray-50 hover:bg-gray-100"
                >
                  <Redo2 className="w-4 h-4 text-black" />
                </button>
              </div>
            </div>

            {/* Pixel Grid Canvas */}
            <div className="p-2 bg-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] rounded-xl flex items-center justify-center overflow-auto max-h-[340px] w-full">
              <canvas
                ref={canvasRef}
                width={editorWidth}
                height={editorHeight}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className="cursor-crosshair border border-black touch-none select-none"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            {/* Image to Pixel Art Upload shortcut */}
            <div className="w-full mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={isProcessingImg}
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#FFE169] hover:bg-yellow-300 border-[2px] border-black shadow-[2px_2px_0px_#000] py-1.5 px-3 rounded-xl text-xs font-black text-black flex items-center justify-center gap-1.5 transition-transform active:scale-98"
              >
                {isProcessingImg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Quantizing Image...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Auto-Convert Image / Logo to Pixels</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Palette & Metadata */}
          <div className="md:col-span-5 space-y-3">
            {/* Color Palette */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black font-mono uppercase text-black">
                  Palette (32 Colors)
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-gray-500 font-bold">Active:</span>
                  <div
                    className="w-4 h-4 rounded border border-black shadow-xs"
                    style={{ backgroundColor: selectedColor }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-8 gap-1 bg-white border-[2px] border-black p-2 rounded-xl">
                {NEO_BRUTALIST_PALETTE.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      setSelectedColor(col);
                      setCustomHex(col);
                    }}
                    style={{ backgroundColor: col }}
                    className={`w-5 h-5 rounded-sm border border-black transition-transform ${
                      selectedColor === col ? 'scale-125 ring-2 ring-black z-10' : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>

              {/* Custom Hex input */}
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    setSelectedColor(e.target.value);
                  }}
                  className="w-7 h-7 p-0 border-[2px] border-black rounded cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                      setSelectedColor(e.target.value);
                    }
                  }}
                  placeholder="#FF6B6B"
                  className="w-full px-2 py-1 bg-white border-[2px] border-black rounded-lg text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Note & Metadata Inputs */}
            <div>
              <label className="block text-xs font-extrabold font-mono uppercase text-black mb-1">
                Plot Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border-[2px] border-black rounded-xl text-xs font-bold focus:bg-yellow-50 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold font-mono uppercase text-black mb-1">
                Pop-up Note / Message
              </label>
              <textarea
                rows={2}
                maxLength={400}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border-[2px] border-black rounded-xl text-xs focus:bg-yellow-50 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold font-mono uppercase text-black mb-1">
                Link URL
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://"
                className="w-full px-2.5 py-1.5 bg-white border-[2px] border-black rounded-xl text-xs font-mono focus:bg-yellow-50 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-3 flex items-center justify-end gap-2.5 border-t-[2px] border-black">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-gray-100 border-[2px] border-black shadow-[2px_2px_0px_#000] px-4 py-2 rounded-xl text-xs font-extrabold text-black"
          >
            Cancel
          </button>
          <button
            id="btn-save-plot-artwork"
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="bg-[#10AC84] text-white hover:bg-teal-700 disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-transform"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Canvas...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Artwork & Notes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
