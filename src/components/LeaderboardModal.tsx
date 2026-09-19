import React, { useEffect, useState } from 'react';
import {
  Trophy,
  X,
  Medal,
  ExternalLink,
  Loader2,
  Sparkles,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { LeaderboardEntry, Plot } from '../types';
import { getTopLeaderboard } from '../lib/firebase';

interface LeaderboardModalProps {
  plots: Plot[];
  onClose: () => void;
  onJumpToProps: (x: number, y: number) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  plots,
  onClose,
  onJumpToProps,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      setIsLoading(true);
      try {
        const remote = await getTopLeaderboard();

        // Calculate plot coordinates mapping from active plots in memory
        const plotMap = new Map<string, { x: number; y: number; maxPixels: number }>();
        plots.forEach((p) => {
          const current = plotMap.get(p.ownerUsername);
          if (!current || p.pixelCount > current.maxPixels) {
            plotMap.set(p.ownerUsername, { x: p.x, y: p.y, maxPixels: p.pixelCount });
          }
        });

        // Also aggregate local plots if remote is empty or building initial list
        if (remote.length === 0 && plots.length > 0) {
          const userAgg = new Map<string, LeaderboardEntry>();
          plots.forEach((p) => {
            const existing = userAgg.get(p.ownerUsername);
            if (existing) {
              existing.totalPixelsBought += p.pixelCount;
              existing.totalSpent += p.pricePaid;
            } else {
              userAgg.set(p.ownerUsername, {
                rank: 0,
                uid: p.ownerId,
                username: p.ownerUsername,
                profileId: p.ownerProfileId,
                displayName: p.ownerUsername,
                photoURL: p.ownerPhotoURL,
                totalPixelsBought: p.pixelCount,
                totalSpent: p.pricePaid,
                largestPlotCoords: { x: p.x, y: p.y },
              });
            }
          });

          const sorted = Array.from(userAgg.values())
            .sort((a, b) => b.totalPixelsBought - a.totalPixelsBought)
            .slice(0, 50)
            .map((item, idx) => ({
              ...item,
              rank: idx + 1,
              largestPlotCoords: plotMap.get(item.username)
                ? { x: plotMap.get(item.username)!.x, y: plotMap.get(item.username)!.y }
                : undefined,
            }));
          setEntries(sorted);
        } else {
          // Enrich remote entries with plot coordinates
          const enriched = remote.map((entry, idx) => {
            const coords = plotMap.get(entry.username);
            return {
              ...entry,
              rank: idx + 1,
              largestPlotCoords: coords ? { x: coords.x, y: coords.y } : undefined,
            };
          });
          setEntries(enriched);
        }
      } catch (err) {
        console.warn('Leaderboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadLeaderboard();
  }, [plots]);

  return (
    <div
      id="leaderboard-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-2xl w-full p-4 sm:p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#FFE169] border-[2px] border-black shadow-[2px_2px_0px_#000] p-2 rounded-xl">
              <Trophy className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black">
                TOP 50 CANVAS TITANS
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                The biggest landowners of the 4 Million Dollar Canvas.
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

        {/* Content List */}
        <div className="max-h-[440px] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 font-mono text-xs">
              <Loader2 className="w-6 h-6 animate-spin mb-2 text-black" />
              <span>Gathering canvas telemetry...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-mono text-xs">
              No pixel purchases recorded yet. Be the first to claim a plot!
            </div>
          ) : (
            entries.map((entry) => {
              const dominance = ((entry.totalPixelsBought / 4000000) * 100).toFixed(3);
              const isTop1 = entry.rank === 1;
              const isTop2 = entry.rank === 2;
              const isTop3 = entry.rank === 3;

              return (
                <div
                  key={entry.username}
                  className={`border-[2px] border-black p-3 rounded-xl flex items-center justify-between gap-2 transition-transform hover:-translate-y-0.5 ${
                    isTop1
                      ? 'bg-[#FFE169] shadow-[3px_3px_0px_#000]'
                      : isTop2
                      ? 'bg-[#FAF8F5] shadow-[2px_2px_0px_#000]'
                      : isTop3
                      ? 'bg-[#FFA97A]/40 shadow-[2px_2px_0px_#000]'
                      : 'bg-white shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  {/* Rank & User Details */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg border border-black flex items-center justify-center font-mono font-extrabold text-xs shrink-0 ${
                        isTop1
                          ? 'bg-black text-[#FFE169]'
                          : isTop2
                          ? 'bg-gray-200 text-black'
                          : isTop3
                          ? 'bg-[#FFA97A] text-black'
                          : 'bg-white text-gray-700'
                      }`}
                    >
                      {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${entry.rank}`}
                    </div>

                    {entry.photoURL ? (
                      <img
                        src={entry.photoURL}
                        alt={entry.username}
                        className="w-8 h-8 rounded-full border border-black object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#4ECDC4] border border-black flex items-center justify-center font-bold text-xs shrink-0">
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm font-mono text-black">
                          @{entry.username}
                        </span>
                        <span className="text-[10px] font-mono text-gray-600 bg-white/70 px-1 border border-black/30 rounded">
                          {entry.profileId}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-600 flex items-center gap-1">
                        <TrendingUp className="w-2.5 h-2.5" />
                        <span>{dominance}% of 4M Canvas</span>
                      </div>
                    </div>
                  </div>

                  {/* Pixel Stats & Jump Button */}
                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono">
                      <div className="text-xs font-black text-black">
                        {entry.totalPixelsBought.toLocaleString()} px
                      </div>
                      <div className="text-[10px] font-bold text-[#10AC84]">
                        ${entry.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {entry.largestPlotCoords && (
                      <button
                        onClick={() => {
                          onJumpToProps(entry.largestPlotCoords!.x, entry.largestPlotCoords!.y);
                          onClose();
                        }}
                        title="Jump to their territory on the canvas"
                        className="bg-white hover:bg-yellow-100 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-transform"
                      >
                        <MapPin className="w-3.5 h-3.5 text-black" />
                        <span className="hidden sm:inline">Jump</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-3 border-t-[2px] border-black flex items-center justify-between text-xs font-mono">
          <span className="text-gray-500 font-bold">1 px = $0.25 | 4 px = $1.00 USD</span>
          <button
            onClick={onClose}
            className="bg-black hover:bg-gray-800 text-white border-[2px] border-black shadow-[2px_2px_0px_#000] px-4 py-1.5 rounded-xl font-bold"
          >
            Close Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
};
