import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Sparkles,
  CheckCircle,
  ExternalLink,
  Loader2,
  Paintbrush,
  QrCode,
  DollarSign,
} from 'lucide-react';
import { PixelSelection, UserProfile, Plot } from '../types';
import { NEO_BRUTALIST_PALETTE, PRICE_PER_PIXEL } from '../lib/canvasUtils';
import confetti from 'canvas-confetti';

interface BuyPixelsModalProps {
  selection: PixelSelection;
  user: UserProfile;
  onClose: () => void;
  onSuccess: (newPlot: Plot) => void;
}

export const BuyPixelsModal: React.FC<BuyPixelsModalProps> = ({
  selection,
  user,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [initialColor, setInitialColor] = useState('#FFE169');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'paypal' | 'crypto'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const pixelCount = selection.pixelCount;
  const costUSD = selection.cost;
  const costINR = (costUSD * 86.5).toFixed(0); // Approximate USD to INR

  const handlePurchase = async () => {
    if (!title.trim()) {
      setErrorMsg('Please give your plot a title.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      // Generate initial pixels flat array filled with initialColor
      const pixels: string[] = [];
      for (let py = 0; py < selection.height; py++) {
        for (let px = 0; px < selection.width; px++) {
          if (
            px === 0 ||
            px === selection.width - 1 ||
            py === 0 ||
            py === selection.height - 1
          ) {
            pixels.push('#000000'); // neat 1px boundary
          } else {
            pixels.push(initialColor);
          }
        }
      }

      const plotId = `plot_x${selection.x}_y${selection.y}_w${selection.width}_h${selection.height}_${Date.now().toString(36)}`;

      const newPlot: Plot = {
        id: plotId,
        ownerId: user.uid,
        ownerUsername: user.username,
        ownerProfileId: user.profileId,
        ownerPhotoURL: user.photoURL,
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
        pixelCount: selection.pixelCount,
        pricePaid: selection.cost,
        title: title.trim(),
        note: note.trim() || 'Claimed on Million Dollar Canvas.',
        linkUrl: linkUrl.trim(),
        pixels,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Simulated demo delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Trigger festive celebratory confetti
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFE169', '#FF6B6B', '#4ECDC4', '#A388EE', '#FFA97A'],
      });

      onSuccess(newPlot);
    } catch (err: any) {
      console.error('Purchase failed:', err);
      setErrorMsg('Transaction failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="buy-pixels-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-lg w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#FF6B6B] border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-xl">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black">
                CLAIM CANVAS PIXELS
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                Coordinates: ({selection.x}, {selection.y}) to ({selection.x + selection.width - 1}, {selection.y + selection.height - 1})
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

        {errorMsg && (
          <div className="mb-3 bg-red-100 border-[2px] border-black text-red-800 text-xs font-bold p-2.5 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Calculation Card */}
        <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-3 rounded-xl mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono text-gray-500 font-bold uppercase">Plot Size</div>
            <div className="text-base font-black font-mono text-black">
              {selection.width} × {selection.height} = {pixelCount.toLocaleString()} px
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-gray-500 font-bold uppercase">
              Total Amount ($0.25 / px)
            </div>
            <div className="text-lg font-black font-mono text-[#10AC84]">
              ${costUSD.toFixed(2)} USD{' '}
              <span className="text-xs text-gray-500 font-normal font-sans">(~₹{costINR})</span>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-3">
          {/* Plot Title */}
          <div>
            <label className="block text-xs font-extrabold font-mono uppercase text-black mb-1">
              Plot Title *
            </label>
            <input
              id="input-plot-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Pixel Mona Lisa / Web3 Developers"
              className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold focus:bg-yellow-50 focus:outline-hidden"
            />
          </div>

          {/* Interactive Note (pops up when visitors click) */}
          <div>
            <label className="block text-xs font-extrabold font-mono uppercase text-black mb-1">
              Plot Note / Pop-up Message *
            </label>
            <textarea
              id="input-plot-note"
              rows={2}
              maxLength={400}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Leave your permanent message, slogan, or story! Visitors see this when they click your pixels."
              className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs focus:bg-yellow-50 focus:outline-hidden resize-none"
            />
          </div>

          {/* External Link */}
          <div>
            <label className="block text-xs font-extrabold font-mono uppercase text-black mb-1">
              Website / Profile URL (Optional)
            </label>
            <div className="relative">
              <input
                id="input-plot-link"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://yourwebsite.com or https://x.com/yourhandle"
                className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-mono focus:bg-yellow-50 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Initial Base Color */}
          <div>
            <label className="block text-xs font-extrabold font-mono uppercase text-black mb-1.5">
              Initial Background Color
            </label>
            <div className="flex items-center gap-1.5 flex-wrap bg-white border-[2px] border-black p-2 rounded-xl">
              {NEO_BRUTALIST_PALETTE.slice(0, 14).map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setInitialColor(col)}
                  style={{ backgroundColor: col }}
                  className={`w-6 h-6 rounded-md border border-black transition-transform ${
                    initialColor === col ? 'scale-120 ring-2 ring-black shadow-xs' : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
            <p className="text-[10px] text-gray-500 font-mono mt-1">
              You can paint detailed custom pixel art or upload an image anytime after buying!
            </p>
          </div>

          {/* Demo Payment Selector */}
          <div className="bg-[#FFE169]/30 border-[2px] border-black p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black font-mono uppercase text-black">
                Demo Checkout Mode (Simulated Payment)
              </span>
              <span className="bg-[#10AC84] text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-black">
                Instant Demo
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-2 rounded-xl border-[2px] border-black text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-white shadow-[2px_2px_0px_#000]'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Credit Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`p-2 rounded-xl border-[2px] border-black text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'upi'
                    ? 'bg-white shadow-[2px_2px_0px_#000]'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <QrCode className="w-4 h-4 text-green-600" />
                <span>UPI / India</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                className={`p-2 rounded-xl border-[2px] border-black text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'paypal'
                    ? 'bg-white shadow-[2px_2px_0px_#000]'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <DollarSign className="w-4 h-4 text-blue-700" />
                <span>PayPal</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('crypto')}
                className={`p-2 rounded-xl border-[2px] border-black text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'crypto'
                    ? 'bg-white shadow-[2px_2px_0px_#000]'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Crypto / ETH</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-gray-100 border-[2px] border-black shadow-[2px_2px_0px_#000] px-4 py-2 rounded-xl text-xs font-extrabold text-black"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-purchase"
            type="button"
            disabled={isProcessing}
            onClick={handlePurchase}
            className="bg-[#4ECDC4] hover:bg-teal-300 disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] px-5 py-2 rounded-xl text-xs font-black text-black flex items-center gap-1.5 transition-transform"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authorizing & Minting...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Buy Pixels (${costUSD.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
