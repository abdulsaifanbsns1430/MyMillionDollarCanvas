import React from 'react';
import {
  Hand,
  MousePointer,
  ZoomIn,
  ZoomOut,
  Maximize,
  ShoppingCart,
  X,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import { PixelSelection, ViewportState } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../lib/canvasUtils';

interface ToolbarProps {
  mode: 'pan' | 'select';
  onModeChange: (mode: 'pan' | 'select') => void;
  selectionAction: 'add' | 'remove';
  onSelectionActionChange: (action: 'add' | 'remove') => void;
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  selection: PixelSelection | null;
  onClearSelection: () => void;
  onOpenBuyModal: () => void;
  containerWidth: number;
  containerHeight: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  onModeChange,
  selectionAction,
  onSelectionActionChange,
  viewport,
  onViewportChange,
  selection,
  onClearSelection,
  onOpenBuyModal,
  containerWidth,
  containerHeight,
}) => {
  const handleZoomIn = () => {
    const newZoom = Math.min(32, viewport.zoom * 1.3);
    onViewportChange({
      ...viewport,
      x: containerWidth / 2 - (containerWidth / 2 - viewport.x) * (newZoom / viewport.zoom),
      y: containerHeight / 2 - (containerHeight / 2 - viewport.y) * (newZoom / viewport.zoom),
      zoom: newZoom,
    });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.2, viewport.zoom * 0.7);
    onViewportChange({
      ...viewport,
      x: containerWidth / 2 - (containerWidth / 2 - viewport.x) * (newZoom / viewport.zoom),
      y: containerHeight / 2 - (containerHeight / 2 - viewport.y) * (newZoom / viewport.zoom),
      zoom: newZoom,
    });
  };

  const handleResetView = () => {
    onViewportChange({
      x: containerWidth / 2 - (CANVAS_WIDTH / 2) * 1.0,
      y: containerHeight / 2 - (CANVAS_HEIGHT / 2) * 1.0,
      zoom: 1.0,
    });
  };

  const numRegions = selection?.regions?.length || (selection ? 1 : 0);

  return (
    <aside
      id="canvas-floating-toolbar"
      aria-label="Canvas editing controls"
      className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 select-none pointer-events-auto max-w-[95vw]"
    >
      {/* Primary Tool Bar */}
      <div className="bg-[#FAF8F5] border-[2.5px] border-black shadow-[4px_4px_0px_#000] p-1.5 rounded-2xl flex items-center gap-1 sm:gap-2 overflow-x-auto">
        {/* Pan Mode (Default) */}
        <button
          id="btn-tool-pan"
          onClick={() => onModeChange('pan')}
          title="Pan & Explore Canvas"
          className={`px-3 py-1.5 rounded-xl border-[2px] border-black font-extrabold text-xs flex items-center gap-1.5 transition-all ${
            mode === 'pan'
              ? 'bg-[#FFE169] shadow-[2px_2px_0px_#000] translate-x-0.5 translate-y-0.5'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <Hand className="w-3.5 h-3.5 text-black" />
          <span>Pan</span>
        </button>

        {/* Select Mode */}
        <button
          id="btn-tool-select"
          onClick={() => onModeChange('select')}
          title="Drag mouse/finger to Select Pixels"
          className={`px-3 py-1.5 rounded-xl border-[2px] border-black font-extrabold text-xs flex items-center gap-1.5 transition-all ${
            mode === 'select'
              ? 'bg-[#4ECDC4] shadow-[2px_2px_0px_#000] translate-x-0.5 translate-y-0.5'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5 text-black" />
          <span>Select Pixels</span>
        </button>

        {/* If in select mode: Toggle between Add and Erase Area */}
        {mode === 'select' && (
          <div className="flex items-center bg-gray-200 border-[1.5px] border-black rounded-xl p-0.5 ml-1">
            <button
              id="btn-subtool-add"
              onClick={() => onSelectionActionChange('add')}
              title="Add more pixels or multiple areas"
              className={`px-2 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all ${
                selectionAction === 'add'
                  ? 'bg-white text-black border border-black shadow-[1px_1px_0px_#000]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Plus className="w-3 h-3 text-emerald-600" />
              <span>Add</span>
            </button>
            <button
              id="btn-subtool-remove"
              onClick={() => onSelectionActionChange('remove')}
              title="Drag over already selected pixels to remove/erase them"
              className={`px-2 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all ${
                selectionAction === 'remove'
                  ? 'bg-[#FF6B6B] text-black border border-black shadow-[1px_1px_0px_#000]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Minus className="w-3 h-3 text-black" />
              <span>Erase</span>
            </button>
          </div>
        )}

        <div className="h-5 w-[2px] bg-black/20 mx-0.5" />

        {/* Zoom Controls */}
        <button
          id="btn-tool-zoom-in"
          onClick={handleZoomIn}
          title="Zoom In"
          className="bg-white hover:bg-yellow-50 border-[2px] border-black p-1.5 rounded-xl transition-transform active:scale-95"
        >
          <ZoomIn className="w-3.5 h-3.5 text-black" />
        </button>

        <button
          id="btn-tool-zoom-out"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="bg-white hover:bg-yellow-50 border-[2px] border-black p-1.5 rounded-xl transition-transform active:scale-95"
        >
          <ZoomOut className="w-3.5 h-3.5 text-black" />
        </button>

        <button
          id="btn-tool-reset"
          onClick={handleResetView}
          title="Reset View to Center"
          className="bg-white hover:bg-yellow-50 border-[2px] border-black p-1.5 rounded-xl transition-transform active:scale-95 text-xs font-bold font-mono"
        >
          <Maximize className="w-3.5 h-3.5 text-black" />
        </button>
      </div>

      {/* Dynamic Selection Action Pill */}
      {selection && selection.pixelCount > 0 && (
        <div className="bg-white border-[2.5px] border-black shadow-[4px_4px_0px_#000] p-2 rounded-2xl flex flex-wrap items-center justify-center gap-2.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="bg-[#FFE169] border border-black px-2 py-0.5 rounded-md font-extrabold text-black">
              {numRegions > 1 ? `${numRegions} Areas • ` : ''}
              {selection.pixelCount.toLocaleString()} px
            </span>
            <span className="font-extrabold text-black font-sans">
              ${selection.cost.toFixed(2)} USD
            </span>
            <span className="text-[10px] text-gray-500 font-mono">($0.50/px)</span>
          </div>

          {selection.excludedOwnedPixelsCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-amber-600" />
              <span>Trimmed {selection.excludedOwnedPixelsCount.toLocaleString()} owned px</span>
            </div>
          )}

          <button
            id="btn-buy-selection"
            onClick={onOpenBuyModal}
            className="bg-[#FF6B6B] hover:bg-red-400 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] px-3.5 py-1 rounded-xl text-xs font-black text-black flex items-center gap-1.5 transition-transform"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Buy Pixels (${selection.cost.toFixed(2)})</span>
          </button>

          <button
            onClick={onClearSelection}
            title="Clear Selection"
            className="text-gray-500 hover:text-black hover:bg-gray-100 p-1 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};
