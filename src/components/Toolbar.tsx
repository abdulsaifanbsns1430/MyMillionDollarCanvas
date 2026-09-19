import React from 'react';
import {
  Hand,
  MousePointer,
  ZoomIn,
  ZoomOut,
  Maximize,
  ShoppingCart,
  X,
  AlertTriangle,
} from 'lucide-react';
import { PixelSelection, ViewportState } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../lib/canvasUtils';

interface ToolbarProps {
  mode: 'pan' | 'select';
  onModeChange: (mode: 'pan' | 'select') => void;
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
    // Center at center of canvas (1000, 1000) with 1x zoom
    onViewportChange({
      x: containerWidth / 2 - (CANVAS_WIDTH / 2) * 1.2,
      y: containerHeight / 2 - (CANVAS_HEIGHT / 2) * 1.2,
      zoom: 1.2,
    });
  };

  return (
    <aside
      id="canvas-floating-toolbar"
      aria-label="Canvas editing controls"
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 select-none pointer-events-auto"
    >
      {/* Primary Tool Bar */}
      <div className="bg-[#FAF8F5] border-[2.5px] border-black shadow-[4px_4px_0px_#000] p-1.5 rounded-2xl flex items-center gap-1.5 sm:gap-2">
        {/* Pan Mode */}
        <button
          id="btn-tool-pan"
          onClick={() => onModeChange('pan')}
          title="Pan & Navigate (Hold Spacebar)"
          className={`px-3 py-1.5 rounded-xl border-[2px] border-black font-extrabold text-xs flex items-center gap-1.5 transition-all ${
            mode === 'pan'
              ? 'bg-[#FFE169] shadow-[2px_2px_0px_#000] translate-x-0.5 translate-y-0.5'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <Hand className="w-3.5 h-3.5 text-black" />
          <span className="hidden sm:inline">Pan</span>
        </button>

        {/* Select Mode */}
        <button
          id="btn-tool-select"
          onClick={() => onModeChange('select')}
          title="Drag to Select Pixels"
          className={`px-3 py-1.5 rounded-xl border-[2px] border-black font-extrabold text-xs flex items-center gap-1.5 transition-all ${
            mode === 'select'
              ? 'bg-[#4ECDC4] shadow-[2px_2px_0px_#000] translate-x-0.5 translate-y-0.5'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5 text-black" />
          <span className="hidden sm:inline">Select Pixels</span>
        </button>

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

      {/* Dynamic Selection Action Pill (shown when user selects an area) */}
      {selection && (
        <div className="bg-white border-[2.5px] border-black shadow-[4px_4px_0px_#000] p-2 rounded-2xl flex items-center gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="bg-[#FFE169] border border-black px-2 py-0.5 rounded font-bold">
              {selection.width} × {selection.height} = {selection.pixelCount} px
            </span>
            <span className="font-extrabold text-black font-sans">
              Total: ${selection.cost.toFixed(2)} USD
            </span>
          </div>

          {selection.hasCollision ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-300 px-2 py-1 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Collision! Overlaps claimed area</span>
            </div>
          ) : (
            <button
              id="btn-buy-selection"
              onClick={onOpenBuyModal}
              className="bg-[#FF6B6B] hover:bg-red-400 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] px-3.5 py-1 rounded-xl text-xs font-black text-black flex items-center gap-1.5 transition-transform"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Buy Area (${selection.cost.toFixed(2)})</span>
            </button>
          )}

          <button
            onClick={onClearSelection}
            title="Clear Selection"
            className="text-gray-500 hover:text-black hover:bg-gray-100 p-1 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};
