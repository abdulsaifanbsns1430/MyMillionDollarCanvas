import React, { useRef } from 'react';
import {
  WorkflowStep,
  SelectTool,
  PaintTool,
  PixelSelection,
} from '../types';
import {
  NEO_BRUTALIST_PALETTE,
  PRICE_PER_PIXEL,
} from '../lib/canvasUtils';
import {
  Plus,
  Eraser,
  Hand,
  Paintbrush,
  PaintBucket,
  Pipette,
  Image as ImageIcon,
  ArrowRight,
  ArrowLeft,
  X,
  Trash2,
  Sparkles,
  ShoppingBag,
  Layers,
} from 'lucide-react';

interface BottomStudioBarProps {
  step: WorkflowStep;
  inspectCoord: { x: number; y: number } | null;
  selectTool: SelectTool;
  onSelectToolChange: (tool: SelectTool) => void;
  paintTool: PaintTool;
  onPaintToolChange: (tool: PaintTool) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  selection: PixelSelection | null;
  onStartSelecting: () => void;
  onClearSelection: () => void;
  onCancelWorkflow: () => void;
  onProceedToPaint: () => void;
  onBackToSelect: () => void;
  onProceedToCheckout: () => void;
  onUploadImage: (file: File) => void;
}

export const BottomStudioBar: React.FC<BottomStudioBarProps> = ({
  step,
  inspectCoord,
  selectTool,
  onSelectToolChange,
  paintTool,
  onPaintToolChange,
  currentColor,
  onColorChange,
  selection,
  onStartSelecting,
  onClearSelection,
  onCancelWorkflow,
  onProceedToPaint,
  onBackToSelect,
  onProceedToCheckout,
  onUploadImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (step === 'idle') {
    return null;
  }

  const pixelCount = selection?.pixelCount || 0;
  const totalCost = pixelCount * PRICE_PER_PIXEL;

  // STEP 0: INSPECT UNOWNED PIXEL PILL
  if (step === 'inspect' && inspectCoord) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-xl w-11/12 sm:w-auto animate-in slide-in-from-bottom-5 duration-200">
        <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] p-3 sm:p-4 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-6">
          {/* Coordinate & Rate Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE169] border-[2px] border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase font-mono tracking-wide text-gray-500">
                  Unclaimed Pixel
                </span>
                <span className="bg-black text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                  X:{inspectCoord.x}, Y:{inspectCoord.y}
                </span>
              </div>
              <div className="text-sm font-black font-mono text-black mt-0.5">
                $0.50 <span className="text-xs text-gray-600 font-bold">per pixel</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onCancelWorkflow}
              className="p-2 rounded-xl border-[2px] border-black bg-white hover:bg-gray-100 transition-transform active:translate-y-0.5"
              title="Dismiss"
            >
              <X className="w-4 h-4 text-black" />
            </button>
            <button
              onClick={onStartSelecting}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border-[2.5px] border-black bg-[#1DD1A1] hover:bg-[#10AC84] text-black font-black text-sm font-mono shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Buy Pixels</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 1: SELECTION STUDIO
  if (step === 'select') {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-3xl w-11/12 sm:w-auto animate-in slide-in-from-bottom-5 duration-200">
        <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] p-3 sm:p-4 rounded-2xl flex flex-col gap-3">
          {/* Main Controls Row */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            {/* Tools Selector */}
            <div className="flex items-center gap-1.5 bg-[#ECE7DE] p-1.5 rounded-xl border-[2px] border-black">
              <button
                onClick={() => onSelectToolChange('add')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black font-mono border-[1.5px] transition-all ${
                  selectTool === 'add'
                    ? 'bg-[#FFE169] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Add pixels to selection (Drag or click)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>

              <button
                onClick={() => onSelectToolChange('erase')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black font-mono border-[1.5px] transition-all ${
                  selectTool === 'erase'
                    ? 'bg-[#FF7675] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Erase / unselect pixels from selection"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Erase</span>
              </button>

              <button
                onClick={() => onSelectToolChange('pan')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black font-mono border-[1.5px] transition-all ${
                  selectTool === 'pan'
                    ? 'bg-white text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Pan / Move canvas"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>Pan</span>
              </button>
            </div>

            {/* Live Pixel Counter & Pricing */}
            <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_#000]">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase font-mono text-gray-500">
                  Selected Pixels
                </span>
                <span className="text-sm font-black font-mono text-black">
                  {pixelCount.toLocaleString()} px
                </span>
              </div>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase font-mono text-gray-500">
                  Total ($0.50/px)
                </span>
                <span className="text-sm font-black font-mono text-[#10AC84]">
                  ${totalCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center gap-2 ml-auto">
              {pixelCount > 0 && (
                <button
                  onClick={onClearSelection}
                  className="p-2 rounded-xl border-[2px] border-black bg-white hover:bg-red-50 text-red-600 transition-all hover:shadow-[2px_2px_0px_#000]"
                  title="Clear current selection"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onCancelWorkflow}
                className="px-3 py-2 rounded-xl border-[2px] border-black bg-white hover:bg-gray-100 text-black text-xs font-mono font-bold transition-all"
              >
                Cancel
              </button>

              <button
                disabled={pixelCount === 0}
                onClick={onProceedToPaint}
                className={`px-4 py-2 rounded-xl border-[2.5px] border-black font-black text-xs font-mono flex items-center gap-1.5 transition-all ${
                  pixelCount > 0
                    ? 'bg-[#1DD1A1] hover:bg-[#10AC84] text-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 border-gray-400 cursor-not-allowed'
                }`}
              >
                <span>Next: Paint</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Helper Subtext */}
          <div className="text-[11px] font-mono text-gray-600 flex items-center justify-between border-t border-gray-200 pt-1.5 px-1">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-gray-500" />
              Drag to select pixels. Connected and separated pixels will combine as one unified area!
            </span>
            <span className="hidden sm:inline text-gray-400">
              Hold Space + Drag to pan anytime
            </span>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: PAINT & IMAGE STUDIO
  if (step === 'paint') {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-11/12 sm:w-auto animate-in slide-in-from-bottom-5 duration-200">
        <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] p-3 sm:p-4 rounded-2xl flex flex-col gap-2.5">
          {/* Top Row: Paint Tools, Image Upload, Live Price, and Navigation */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
            {/* Paint Tools */}
            <div className="flex items-center gap-1 bg-[#ECE7DE] p-1 rounded-xl border-[2px] border-black">
              <button
                onClick={() => onPaintToolChange('brush')}
                className={`p-2 rounded-lg border-[1.5px] transition-all ${
                  paintTool === 'brush'
                    ? 'bg-[#FFE169] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Brush (Paint on selected pixels)"
              >
                <Paintbrush className="w-4 h-4" />
              </button>

              <button
                onClick={() => onPaintToolChange('eraser')}
                className={`p-2 rounded-lg border-[1.5px] transition-all ${
                  paintTool === 'eraser'
                    ? 'bg-[#FF7675] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Eraser (Clear painted color)"
              >
                <Eraser className="w-4 h-4" />
              </button>

              <button
                onClick={() => onPaintToolChange('bucket')}
                className={`p-2 rounded-lg border-[1.5px] transition-all ${
                  paintTool === 'bucket'
                    ? 'bg-[#4ECDC4] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Bucket Fill (Fill selected pixels with color)"
              >
                <PaintBucket className="w-4 h-4" />
              </button>

              <button
                onClick={() => onPaintToolChange('eyedropper')}
                className={`p-2 rounded-lg border-[1.5px] transition-all ${
                  paintTool === 'eyedropper'
                    ? 'bg-[#A388EE] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Eyedropper (Pick color from canvas)"
              >
                <Pipette className="w-4 h-4" />
              </button>

              <button
                onClick={() => onPaintToolChange('pan')}
                className={`p-2 rounded-lg border-[1.5px] transition-all ${
                  paintTool === 'pan'
                    ? 'bg-white text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'border-transparent text-gray-700 hover:bg-white/60'
                }`}
                title="Pan Canvas"
              >
                <Hand className="w-4 h-4" />
              </button>
            </div>

            {/* Insert Image Button */}
            <div className="flex items-center">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUploadImage(file);
                    e.target.value = '';
                  }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl border-[2px] border-black bg-[#54A0FF] hover:bg-[#2E86DE] text-black font-black text-xs font-mono shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] flex items-center gap-1.5 transition-all"
                title="Insert an image mapped across all selected pixels"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Insert Image</span>
              </button>
            </div>

            {/* Live Pixel Counter & Price */}
            <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_#000]">
              <span className="text-xs font-black font-mono text-black">
                {pixelCount.toLocaleString()} px
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-xs font-black font-mono text-[#10AC84]">
                ${totalCost.toFixed(2)}
              </span>
            </div>

            {/* Flow Navigation */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={onBackToSelect}
                className="px-3 py-2 rounded-xl border-[2px] border-black bg-white hover:bg-gray-100 text-black text-xs font-mono font-bold flex items-center gap-1 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                onClick={onProceedToCheckout}
                className="px-4 py-2 rounded-xl border-[2.5px] border-black bg-[#1DD1A1] hover:bg-[#10AC84] text-black font-black text-xs font-mono shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>Next: Checkout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Color Swatches & Native Color Picker */}
          <div className="flex items-center gap-2 border-t border-gray-200 pt-2 overflow-x-auto pb-1 max-w-full">
            {/* Active Color Preview & Custom Picker */}
            <div className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_#000]">
              <div
                className="w-6 h-6 rounded-lg border-[2px] border-black shrink-0 relative overflow-hidden"
                style={{ backgroundColor: currentColor }}
              >
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => onColorChange(e.target.value.toUpperCase())}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  title="Choose custom color"
                />
              </div>
              <span className="text-[11px] font-mono font-black text-black">
                {currentColor}
              </span>
            </div>

            {/* Swatch Palette Row */}
            <div className="flex items-center gap-1 shrink-0">
              {NEO_BRUTALIST_PALETTE.map((color) => {
                const isSelected = currentColor.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    onClick={() => onColorChange(color)}
                    className={`w-6 h-6 rounded-lg border-[2px] transition-transform shrink-0 ${
                      isSelected
                        ? 'border-black scale-110 shadow-[2px_2px_0px_#000] z-10'
                        : 'border-black/50 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
