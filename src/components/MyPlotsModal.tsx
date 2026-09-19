import React from 'react';
import { X, Sparkles, Paintbrush, MapPin, ExternalLink } from 'lucide-react';
import { Plot, UserProfile } from '../types';

interface MyPlotsModalProps {
  user: UserProfile;
  plots: Plot[];
  onClose: () => void;
  onEditPlot: (plot: Plot) => void;
  onJumpTo: (x: number, y: number) => void;
}

export const MyPlotsModal: React.FC<MyPlotsModalProps> = ({
  user,
  plots,
  onClose,
  onEditPlot,
  onJumpTo,
}) => {
  const myPlots = plots.filter((p) => p.ownerId === user.uid || p.ownerUsername === user.username);
  const totalPixels = myPlots.reduce((acc, p) => acc + p.pixelCount, 0);
  const totalValue = (totalPixels * 0.25).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return (
    <div
      id="my-plots-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-xl w-full p-4 sm:p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#4ECDC4] border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-xl">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black">
                MY CANVAS EMPIRE
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                @{user.username} • {user.profileId}
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

        {/* Portfolio Stats Card */}
        <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-3.5 rounded-xl mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-gray-500 font-bold uppercase">Total Territories</div>
            <div className="text-base font-black font-mono text-black">
              {myPlots.length} Plots ({totalPixels.toLocaleString()} Pixels)
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-gray-500 font-bold uppercase">Portfolio Value</div>
            <div className="text-base font-black font-mono text-[#10AC84]">{totalValue}</div>
          </div>
        </div>

        {/* Plots List */}
        <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
          {myPlots.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-mono text-xs">
              You don't own any plots yet! Select any area on the canvas and click "Buy Pixels".
            </div>
          ) : (
            myPlots.map((plot) => (
              <div
                key={plot.id}
                className="bg-white border-[2px] border-black shadow-[2px_2px_0px_#000] p-3 rounded-xl flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-extrabold font-mono text-black">{plot.title}</div>
                  <div className="text-[11px] font-mono text-gray-600">
                    Coords: ({plot.x}, {plot.y}) • {plot.width}×{plot.height} ({plot.pixelCount} px) • ${plot.pricePaid.toFixed(2)}
                  </div>
                  {plot.note && (
                    <div className="text-xs text-gray-700 italic mt-1 line-clamp-1">
                      "{plot.note}"
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      onJumpTo(plot.x, plot.y);
                      onClose();
                    }}
                    title="Jump on Canvas"
                    className="bg-gray-100 hover:bg-yellow-100 border border-black p-1.5 rounded-lg text-xs font-bold"
                  >
                    <MapPin className="w-3.5 h-3.5 text-black" />
                  </button>
                  <button
                    onClick={() => {
                      onEditPlot(plot);
                      onClose();
                    }}
                    className="bg-[#FFE169] hover:bg-yellow-300 border border-black p-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Paintbrush className="w-3.5 h-3.5 text-black" />
                    <span className="hidden sm:inline">Paint</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-3 border-t-[2px] border-black flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-black hover:bg-gray-800 text-white border-[2px] border-black shadow-[2px_2px_0px_#000] px-4 py-1.5 rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
