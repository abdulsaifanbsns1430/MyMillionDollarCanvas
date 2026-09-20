import React, { useState, useEffect, useRef } from 'react';
import { Plot, UserProfile, PixelSelection } from '../types';
import { PRICE_PER_PIXEL, hexToRgb } from '../lib/canvasUtils';
import {
  X,
  CreditCard,
  Lock,
  Globe,
  MessageSquare,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface PlotCheckoutModalProps {
  selection: PixelSelection;
  draftPixels: Map<string, string>;
  user: UserProfile;
  onClose: () => void;
  onSuccess: (newPlot: Plot) => Promise<void>;
}

export const PlotCheckoutModal: React.FC<PlotCheckoutModalProps> = ({
  selection,
  draftPixels,
  user,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'instant'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const totalPixels = selection.pixelCount;
  const totalAmount = totalPixels * PRICE_PER_PIXEL;

  // Render thumbnail of user's drafted artwork
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const regions = selection.regions && selection.regions.length > 0 ? selection.regions : [
      { id: '1', x: selection.x, y: selection.y, width: selection.width, height: selection.height, pixelCount: selection.pixelCount, cost: selection.cost }
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    regions.forEach((r) => {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    });

    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);

    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, w, h);

    regions.forEach((r) => {
      for (let py = r.y; py < r.y + r.height; py++) {
        for (let px = r.x; px < r.x + r.width; px++) {
          const key = `${px},${py}`;
          const color = draftPixels.get(key) || '#FFE169';
          ctx.fillStyle = color;
          ctx.fillRect(px - minX, py - minY, 1, 1);
        }
      }
    });
  }, [selection, draftPixels]);

  const handlePayAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a title for your plot.');
      return;
    }

    if (totalPixels <= 0) {
      setErrorMsg('No pixels selected.');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate realistic payment processing
      await new Promise((resolve) => setTimeout(resolve, 800));

      const regions = selection.regions && selection.regions.length > 0 ? selection.regions : [
        { id: '1', x: selection.x, y: selection.y, width: selection.width, height: selection.height, pixelCount: selection.pixelCount, cost: selection.cost }
      ];

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      regions.forEach((r) => {
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
      });

      const w = Math.max(1, maxX - minX);
      const h = Math.max(1, maxY - minY);

      // Build compact pixel array
      const flatPixels: string[] = new Array(w * h).fill('#FAF8F5');
      regions.forEach((r) => {
        for (let py = r.y; py < r.y + r.height; py++) {
          for (let px = r.x; px < r.x + r.width; px++) {
            const key = `${px},${py}`;
            const color = draftPixels.get(key) || '#FFE169';
            const idx = (py - minY) * w + (px - minX);
            flatPixels[idx] = color;
          }
        }
      });

      const cleanLink = linkUrl.trim()
        ? linkUrl.trim().startsWith('http://') || linkUrl.trim().startsWith('https://')
          ? linkUrl.trim()
          : `https://${linkUrl.trim()}`
        : undefined;

      const newPlot: Plot = {
        id: `plot_${minX}_${minY}_${Date.now()}`,
        ownerId: user.uid,
        ownerUsername: user.username,
        ownerProfileId: user.profileId,
        ownerPhotoURL: user.photoURL,
        x: minX,
        y: minY,
        width: w,
        height: h,
        pixelCount: totalPixels,
        pricePaid: totalAmount,
        title: title.trim(),
        note: note.trim() || 'Claimed on Million Dollar Canvas',
        linkUrl: cleanLink,
        pixels: flatPixels,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await onSuccess(newPlot);
    } catch (err: any) {
      console.error('Payment / Plot Claim error:', err);
      setErrorMsg(err.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[8px_8px_0px_#000] rounded-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-[#FFE169] border-b-[3px] border-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-black" />
            <h2 className="font-black font-mono text-lg text-black">
              Claim & Publish Plot
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg border-[2px] border-black bg-white hover:bg-red-50 text-black hover:text-red-600 transition-all hover:shadow-[2px_2px_0px_#000]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handlePayAndSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-red-100 border-[2px] border-red-500 rounded-xl text-red-800 text-xs font-mono font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Plot Summary Card */}
          <div className="bg-white p-3.5 rounded-xl border-[2px] border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row items-center gap-4">
            {/* Artwork Preview */}
            <div className="w-24 h-24 border-[2px] border-black rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-[2px_2px_0px_#000]">
              <canvas
                ref={previewCanvasRef}
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            </div>

            {/* Metrics Breakdown */}
            <div className="flex-1 w-full grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#FAF8F5] p-2 rounded-lg border border-black/30">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">
                  Selected Pixels
                </span>
                <span className="text-sm font-black text-black">
                  {totalPixels.toLocaleString()} px
                </span>
              </div>

              <div className="bg-[#FAF8F5] p-2 rounded-lg border border-black/30">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">
                  Rate
                </span>
                <span className="text-sm font-black text-black">
                  $0.50 / px
                </span>
              </div>

              <div className="bg-[#FAF8F5] p-2 rounded-lg border border-black/30">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">
                  Owner
                </span>
                <span className="text-xs font-black text-black truncate block">
                  @{user.username}
                </span>
              </div>

              <div className="bg-[#E6FFFA] p-2 rounded-lg border border-[#10AC84]">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">
                  Total Due
                </span>
                <span className="text-sm font-black text-[#10AC84]">
                  ${totalAmount.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3 font-mono">
            {/* Title */}
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1">
                Plot Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. My Studio / Crypto Pixel / Acme Corp"
                maxLength={60}
                className="w-full px-3 py-2 text-sm bg-white border-[2px] border-black rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Link URL */}
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-gray-600" />
                <span>Redirect Link (Optional)</span>
              </label>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://yourwebsite.com or @twitter"
                className="w-full px-3 py-2 text-sm bg-white border-[2px] border-black rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Note / Comment */}
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-gray-600" />
                <span>Note / Story / Message</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Write a message visible to everyone who clicks on your plot..."
                className="w-full px-3 py-2 text-sm bg-white border-[2px] border-black rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-black resize-none"
              />
            </div>
          </div>

          {/* Payment Section */}
          <div className="border-t-2 border-dashed border-black/30 pt-3 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-black" />
                <span>Select Payment</span>
              </span>
              <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-green-600" />
                256-Bit Encrypted
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-2.5 rounded-xl border-[2px] flex items-center gap-2 text-xs font-black transition-all ${
                  paymentMethod === 'card'
                    ? 'border-black bg-[#FFE169] shadow-[2px_2px_0px_#000]'
                    : 'border-black/30 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Credit / Debit Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('instant')}
                className={`p-2.5 rounded-xl border-[2px] flex items-center gap-2 text-xs font-black transition-all ${
                  paymentMethod === 'instant'
                    ? 'border-black bg-[#1DD1A1] shadow-[2px_2px_0px_#000]'
                    : 'border-black/30 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Zap className="w-4 h-4 text-black" />
                <span>1-Click Sandbox</span>
              </button>
            </div>

            {paymentMethod === 'card' && (
              <div className="bg-white p-3 rounded-xl border-[2px] border-black space-y-2">
                <input
                  type="text"
                  placeholder="Card Number • 4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-black/40 rounded-lg font-mono focus:outline-hidden"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="MM / YY"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-black/40 rounded-lg font-mono focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="CVC"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-black/40 rounded-lg font-mono focus:outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border-[2px] border-black bg-white hover:bg-gray-100 text-black text-xs font-mono font-bold transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 px-5 py-3 rounded-xl border-[2.5px] border-black bg-[#1DD1A1] hover:bg-[#10AC84] text-black font-black text-sm font-mono shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] transition-all flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Processing Payment...</span>
                </div>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Pay & Claim Plot • ${totalAmount.toFixed(2)} USD</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
