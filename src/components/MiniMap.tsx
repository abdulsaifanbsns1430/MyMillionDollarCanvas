import React, { useRef, useEffect, useState } from 'react';
import { Plot, ViewportState } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../lib/canvasUtils';
import { Compass, Minimize2, Maximize2 } from 'lucide-react';

interface MiniMapProps {
  plots: Plot[];
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  containerWidth: number;
  containerHeight: number;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  plots,
  viewport,
  onViewportChange,
  containerWidth,
  containerHeight,
}) => {
  const [isExpanded, setIsExpanded] = useState(() => window.innerWidth > 768);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapSize = 120; // 120x120 px mini map

  const scale = miniMapSize / CANVAS_WIDTH;

  // Render mini map
  useEffect(() => {
    if (!isExpanded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, miniMapSize, miniMapSize);

    // Canvas background
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, miniMapSize, miniMapSize);

    // Draw plots on mini-map
    plots.forEach((plot) => {
      ctx.fillStyle = '#FF6B6B';
      const mx = plot.x * scale;
      const my = plot.y * scale;
      const mw = Math.max(1.5, plot.width * scale);
      const mh = Math.max(1.5, plot.height * scale);
      ctx.fillRect(mx, my, mw, mh);
    });

    // Draw active viewport rectangle
    const vpWorldX = Math.max(0, -viewport.x / viewport.zoom);
    const vpWorldY = Math.max(0, -viewport.y / viewport.zoom);
    const vpWorldW = containerWidth / viewport.zoom;
    const vpWorldH = containerHeight / viewport.zoom;

    const rX = Math.max(0, Math.min(miniMapSize, vpWorldX * scale));
    const rY = Math.max(0, Math.min(miniMapSize, vpWorldY * scale));
    const rW = Math.min(miniMapSize - rX, vpWorldW * scale);
    const rH = Math.min(miniMapSize - rY, vpWorldH * scale);

    // Viewport box
    ctx.fillStyle = 'rgba(255, 225, 105, 0.4)';
    ctx.fillRect(rX, rY, rW, rH);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rX, rY, rW, rH);
  }, [plots, viewport, containerWidth, containerHeight, isExpanded, scale]);

  const teleportToPos = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const targetWorldX = clickX / scale;
    const targetWorldY = clickY / scale;

    // Center viewport around clicked/touched target
    onViewportChange({
      ...viewport,
      x: containerWidth / 2 - targetWorldX * viewport.zoom,
      y: containerHeight / 2 - targetWorldY * viewport.zoom,
    });
  };

  const handleMiniMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    teleportToPos(e.clientX, e.clientY);
  };

  const handleMiniMapTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      teleportToPos(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  return (
    <div
      id="minimap-radar"
      className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-1 select-none"
    >
      <div className="bg-white border-[2px] sm:border-[2.5px] border-black shadow-[3px_3px_0px_#000] rounded-xl overflow-hidden">
        {/* Radar Header */}
        <div className="bg-[#FFE169] border-b-[2px] border-black px-2 py-1 flex items-center justify-between gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold font-mono text-black uppercase cursor-pointer"
          >
            <Compass className="w-3 h-3 text-black" />
            <span>Radar</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-black hover:bg-black/10 p-0.5 rounded cursor-pointer"
            title={isExpanded ? 'Minimize radar' : 'Expand radar'}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        {isExpanded && (
          <div className="p-1.5 bg-[#FAF8F5]">
            <canvas
              ref={canvasRef}
              width={miniMapSize}
              height={miniMapSize}
              onClick={handleMiniMapClick}
              onTouchStart={handleMiniMapTouch}
              className="border border-black cursor-pointer rounded-sm touch-none"
              title="Tap anywhere to jump on the canvas"
            />
            <div className="text-[9px] font-mono text-center text-gray-500 mt-1 font-bold">
              TAP TO TELEPORT
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
