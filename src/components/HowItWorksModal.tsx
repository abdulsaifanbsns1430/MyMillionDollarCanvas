import React from 'react';
import { X, Sparkles, Layers, DollarSign, Paintbrush, MousePointer } from 'lucide-react';

interface HowItWorksModalProps {
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ onClose }) => {
  return (
    <div
      id="how-it-works-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-lg w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#FFE169] border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-xl">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black">
                HOW MILLION DOLLAR CANVAS WORKS
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                The 1-Million-Pixel Collaborative Internet Monument
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

        {/* Steps Cards */}
        <div className="space-y-3 mb-5">
          {/* Step 1 */}
          <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-3 rounded-xl flex items-start gap-3">
            <div className="w-7 h-7 bg-[#FFE169] border border-black rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0">
              1
            </div>
            <div>
              <div className="text-xs font-black font-mono uppercase text-black">
                Select Your Territory (Multi-Area Supported)
              </div>
              <p className="text-xs text-gray-700 leading-relaxed mt-0.5">
                Switch to <strong>"Select Pixels"</strong> mode. Click & drag anywhere to select one or multiple areas. If your selection touches already-owned pixels, they are automatically excluded so you only pay for unpainted pixels! You can also erase by dragging over them.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-3 rounded-xl flex items-start gap-3">
            <div className="w-7 h-7 bg-[#4ECDC4] border border-black rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0">
              2
            </div>
            <div>
              <div className="text-xs font-black font-mono uppercase text-black">
                Buy at $0.50 Per Pixel (2 px = $1.00)
              </div>
              <p className="text-xs text-gray-700 leading-relaxed mt-0.5">
                The canvas has exactly 1,000,000 pixels (1,000 × 1,000 grid). A 10×10 plot is 100 pixels for $50.00. Payment locks in your permanent ownership in the database forever.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-3 rounded-xl flex items-start gap-3">
            <div className="w-7 h-7 bg-[#A388EE] border border-black rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0">
              3
            </div>
            <div>
              <div className="text-xs font-black font-mono uppercase text-black">
                Interactive Note Pop-up
              </div>
              <p className="text-xs text-gray-700 leading-relaxed mt-0.5">
                Just like The Million Dollar Drawing, whenever any visitor clicks on your pixels, a window pops up showing your personal note, artist story, and website link!
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-3 rounded-xl flex items-start gap-3">
            <div className="w-7 h-7 bg-[#FF6B6B] border border-black rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 text-white">
              4
            </div>
            <div>
              <div className="text-xs font-black font-mono uppercase text-black">
                Paint & Edit Anytime for Free
              </div>
              <p className="text-xs text-gray-700 leading-relaxed mt-0.5">
                You own your territory for life! Open your plot anytime to draw custom pixel art with our 32-color palette, use flood fill, or auto-convert a photo/logo into pixel art.
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-[#FFE169] hover:bg-yellow-300 border-[2px] border-black shadow-[3px_3px_0px_#000] py-2 rounded-xl text-xs font-black font-mono text-black transition-transform active:scale-98"
        >
          Got it! Start Exploring →
        </button>
      </div>
    </div>
  );
};
