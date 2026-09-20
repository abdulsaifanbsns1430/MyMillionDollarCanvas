import React from 'react';
import {
  X,
  ExternalLink,
  Paintbrush,
  Calendar,
  Share2,
  Check,
  Sparkles,
} from 'lucide-react';
import { Plot, UserProfile } from '../types';

interface PlotNoteModalProps {
  plot: Plot;
  currentUser: UserProfile | null;
  onClose: () => void;
  onEditPlot: (plot: Plot) => void;
}

export const PlotNoteModal: React.FC<PlotNoteModalProps> = ({
  plot,
  currentUser,
  onClose,
  onEditPlot,
}) => {
  const [copiedLink, setCopiedLink] = React.useState(false);
  const isOwner = currentUser && currentUser.uid === plot.ownerId;

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?plot=${plot.id}&x=${plot.x}&y=${plot.y}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formattedDate = new Date(plot.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      id="plot-note-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-md w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#FFE169] border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-xl">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-wide">
                Canvas Territory
              </span>
              <h2 className="font-black text-lg sm:text-xl font-mono text-black leading-tight">
                {plot.title || 'Untitled Plot'}
              </h2>
            </div>
          </div>
          <button
            id="btn-close-note-modal"
            onClick={onClose}
            className="text-black hover:bg-black/10 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plot Coordinates & Dimensions badge */}
        <div className="flex flex-wrap items-center gap-2 mb-4 font-mono text-xs">
          <span className="bg-white border-[2px] border-black shadow-[2px_2px_0px_#000] px-2.5 py-1 rounded-xl font-bold">
            Coords: ({plot.x}, {plot.y})
          </span>
          <span className="bg-[#4ECDC4] border-[2px] border-black shadow-[2px_2px_0px_#000] px-2.5 py-1 rounded-xl font-bold text-black">
            {plot.width} × {plot.height} ({plot.pixelCount} px)
          </span>
          <span className="bg-[#A388EE] border-[2px] border-black shadow-[2px_2px_0px_#000] px-2.5 py-1 rounded-xl font-bold text-black">
            ${plot.pricePaid.toFixed(2)} USD
          </span>
        </div>

        {/* Owner Card */}
        <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-3 rounded-xl mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {plot.ownerPhotoURL ? (
              <img
                src={plot.ownerPhotoURL}
                alt={plot.ownerUsername || 'Owner'}
                className="w-10 h-10 rounded-full border-[2px] border-black object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#FFE169] border-[2px] border-black flex items-center justify-center font-bold text-sm">
                {(plot.ownerUsername || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm font-mono text-black">
                  @{plot.ownerUsername || 'anonymous'}
                </span>
                <span className="bg-gray-100 border border-black text-[9px] font-mono px-1 rounded">
                  {plot.ownerProfileId || ''}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                <Calendar className="w-2.5 h-2.5" />
                <span>Claimed on {formattedDate}</span>
              </div>
            </div>
          </div>

          {isOwner && (
            <span className="bg-[#10AC84] text-white border border-black text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              YOU OWN THIS
            </span>
          )}
        </div>

        {/* Note / Message */}
        <div className="bg-[#FAF8F5] border-[2px] border-black p-3.5 rounded-xl mb-4">
          <div className="text-[10px] font-mono uppercase font-black text-gray-500 mb-1">
            Owner's Message
          </div>
          <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed">
            {plot.note || 'No note left by the owner.'}
          </p>
        </div>

        {/* External Link (if provided) */}
        {plot.linkUrl && (
          <div className="mb-4">
            <a
              href={plot.linkUrl.startsWith('http') ? plot.linkUrl : `https://${plot.linkUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#FFE169] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] p-2.5 rounded-xl text-xs font-black text-black flex items-center justify-between transition-transform"
            >
              <div className="flex items-center gap-2 truncate">
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate">{plot.linkUrl}</span>
              </div>
              <span className="shrink-0 text-[10px] uppercase font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                VISIT LINK ↗
              </span>
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t-[2px] border-black">
          <button
            onClick={handleShare}
            className="bg-white hover:bg-gray-100 border-[2px] border-black shadow-[2px_2px_0px_#000] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                <span className="text-green-700">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Plot</span>
              </>
            )}
          </button>

          {isOwner ? (
            <button
              id="btn-edit-plot-artwork"
              onClick={() => onEditPlot(plot)}
              className="bg-[#4ECDC4] hover:bg-teal-300 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] px-4 py-2 rounded-xl text-xs font-black text-black flex items-center gap-1.5 transition-transform"
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Edit Artwork & Note</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="bg-black hover:bg-gray-800 text-white border-[2px] border-black shadow-[2px_2px_0px_#000] px-4 py-2 rounded-xl text-xs font-bold"
            >
              Close Window
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
