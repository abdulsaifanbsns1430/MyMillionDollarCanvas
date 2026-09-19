import React, { useState } from 'react';
import { Search, MapPin, X, Layers } from 'lucide-react';
import { Plot } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../lib/canvasUtils';

interface SearchModalProps {
  plots: Plot[];
  onClose: () => void;
  onJumpTo: (x: number, y: number) => void;
  onSelectPlot: (plot: Plot) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  plots,
  onClose,
  onJumpTo,
  onSelectPlot,
}) => {
  const [coordX, setCoordX] = useState<string>('1000');
  const [coordY, setCoordY] = useState<string>('1000');
  const [query, setQuery] = useState<string>('');

  const handleJumpToCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const x = Math.min(CANVAS_WIDTH - 1, Math.max(0, parseInt(coordX) || 0));
    const y = Math.min(CANVAS_HEIGHT - 1, Math.max(0, parseInt(coordY) || 0));
    onJumpTo(x, y);
    onClose();
  };

  const filteredPlots = query.trim()
    ? plots.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.ownerUsername.toLowerCase().includes(query.toLowerCase()) ||
          p.note.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div
      id="search-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-md w-full p-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#4ECDC4] border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-xl">
              <Search className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg font-mono text-black">
                NAVIGATE & DISCOVER
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                Jump to exact coordinates or search claimed plots.
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

        {/* 1. Coordinate Teleport */}
        <form onSubmit={handleJumpToCoords} className="mb-5 bg-white border-[2px] border-black p-3.5 rounded-xl shadow-[3px_3px_0px_#000]">
          <div className="text-xs font-mono font-black uppercase text-black mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-600" />
            <span>Teleport to Coordinate (0 to 1999)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <label className="block text-[10px] font-mono text-gray-500 font-bold mb-0.5">X Axis</label>
              <input
                type="number"
                min={0}
                max={1999}
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border-[2px] border-black rounded-lg text-sm font-mono font-bold focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-gray-500 font-bold mb-0.5">Y Axis</label>
              <input
                type="number"
                min={0}
                max={1999}
                value={coordY}
                onChange={(e) => setCoordY(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border-[2px] border-black rounded-lg text-sm font-mono font-bold focus:outline-hidden"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-[#FFE169] hover:bg-yellow-300 border-[2px] border-black shadow-[2px_2px_0px_#000] py-1.5 rounded-xl text-xs font-black font-mono text-black transition-transform active:scale-98"
          >
            Teleport Viewport →
          </button>
        </form>

        {/* 2. Plot / Owner Search */}
        <div>
          <div className="text-xs font-mono font-black uppercase text-black mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Search Artwork by Keyword or @Username</span>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type 'burger', 'satoshi', 'dao'..."
            className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold focus:bg-yellow-50 focus:outline-hidden mb-3"
          />

          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {query && filteredPlots.length === 0 ? (
              <div className="text-xs text-gray-500 font-mono text-center py-4">
                No plots found matching "{query}"
              </div>
            ) : (
              filteredPlots.map((plot) => (
                <div
                  key={plot.id}
                  onClick={() => {
                    onJumpTo(plot.x, plot.y);
                    onSelectPlot(plot);
                    onClose();
                  }}
                  className="bg-white hover:bg-yellow-50 border-[1.5px] border-black p-2 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="text-xs font-extrabold font-mono text-black">{plot.title}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      by @{plot.ownerUsername} • ({plot.x}, {plot.y})
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#4ECDC4] px-1.5 py-0.5 rounded border border-black">
                    {plot.pixelCount} px
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
