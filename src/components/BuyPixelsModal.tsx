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
  Layers,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import { PixelSelection, UserProfile, Plot } from '../types';
import { NEO_BRUTALIST_PALETTE, PRICE_PER_PIXEL, processImageToRegions } from '../lib/canvasUtils';
import confetti from 'canvas-confetti';

interface BuyPixelsModalProps {
  selection: PixelSelection;
  user: UserProfile;
  onClose: () => void;
  onSuccess: (newPlots: Plot[]) => void;
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
  const [artMode, setArtMode] = useState<'color' | 'image'>('color');
  const [imagePlacementMode, setImagePlacementMode] = useState<'span' | 'fit'>('span');
  const [uploadedImageMap, setUploadedImageMap] = useState<Map<string, string[]> | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [rawImageFile, setRawImageFile] = useState<File | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'paypal' | 'crypto'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const pixelCount = selection.pixelCount;
  const costUSD = selection.cost;
  const costINR = (costUSD * 86.5).toFixed(0); // Approximate USD to INR

  const regionsToBuy =
    selection.regions && selection.regions.length > 0
      ? selection.regions
      : [
          {
            id: 'primary',
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height,
            pixelCount: selection.pixelCount,
            cost: selection.cost,
          },
        ];

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawImageFile(file);
    setIsProcessingImage(true);
    setErrorMsg('');

    try {
      const previewUrl = URL.createObjectURL(file);
      setUploadedImagePreview(previewUrl);

      const pixelMap = await processImageToRegions(file, regionsToBuy, imagePlacementMode);
      setUploadedImageMap(pixelMap);
      setArtMode('image');
    } catch (err) {
      console.error('Failed to process image into pixels:', err);
      setErrorMsg('Failed to process image. Please try a standard PNG, JPG, or SVG.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handlePlacementModeChange = async (mode: 'span' | 'fit') => {
    setImagePlacementMode(mode);
    if (!rawImageFile) return;

    setIsProcessingImage(true);
    try {
      const pixelMap = await processImageToRegions(rawImageFile, regionsToBuy, mode);
      setUploadedImageMap(pixelMap);
    } catch (err) {
      console.error('Failed to switch placement mode:', err);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handlePurchase = async () => {
    if (!title.trim()) {
      setErrorMsg('Please give your plot a title.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const createdPlots: Plot[] = [];

      regionsToBuy.forEach((region, idx) => {
        let pixels: string[] = [];

        // Check if user uploaded an image for their plot(s)
        if (artMode === 'image' && uploadedImageMap && uploadedImageMap.has(region.id)) {
          pixels = uploadedImageMap.get(region.id)!;
        } else {
          // Generate initial pixels flat array filled with initialColor
          for (let py = 0; py < region.height; py++) {
            for (let px = 0; px < region.width; px++) {
              if (
                px === 0 ||
                px === region.width - 1 ||
                py === 0 ||
                py === region.height - 1
              ) {
                pixels.push('#000000'); // neat 1px boundary
              } else {
                pixels.push(initialColor);
              }
            }
          }
        }

        const plotId = `plot_x${region.x}_y${region.y}_w${region.width}_h${region.height}_${Date.now().toString(36)}_${idx}`;
        const plotTitle =
          regionsToBuy.length > 1
            ? `${title.trim()} (Area ${idx + 1})`
            : title.trim();

        createdPlots.push({
          id: plotId,
          ownerId: user.uid,
          ownerUsername: user.username,
          ownerProfileId: user.profileId,
          ownerPhotoURL: user.photoURL || '',
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          pixelCount: region.pixelCount,
          pricePaid: region.cost,
          title: plotTitle,
          note: note.trim() || 'Claimed on Million Dollar Canvas.',
          linkUrl: linkUrl.trim() || '',
          pixels,
          createdAt: Date.now() + idx,
          updatedAt: Date.now() + idx,
        });
      });

      // Simulated instant demo transaction delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Trigger celebratory confetti
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFE169', '#FF6B6B', '#4ECDC4', '#A388EE', '#FFA97A'],
      });

      onSuccess(createdPlots);
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
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-lg w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200 my-auto">
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
                {regionsToBuy.length > 1
                  ? `${regionsToBuy.length} separate areas selected on canvas`
                  : `Coordinates: (${selection.x}, ${selection.y}) to (${selection.x + selection.width - 1}, ${selection.y + selection.height - 1})`}
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
            <div className="text-[11px] font-mono text-gray-500 font-bold uppercase">
              {regionsToBuy.length > 1 ? `${regionsToBuy.length} Selected Areas` : 'Plot Size'}
            </div>
            <div className="text-base font-black font-mono text-black">
              {pixelCount.toLocaleString()} Pixels
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-gray-500 font-bold uppercase">
              Total (${PRICE_PER_PIXEL.toFixed(2)} / px)
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
            <input
              id="input-plot-link"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://yourwebsite.com or https://x.com/yourhandle"
              className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-mono focus:bg-yellow-50 focus:outline-hidden"
            />
          </div>

          {/* Artwork Selection: Solid Color vs Image Upload */}
          <div className="border-[2px] border-black rounded-xl p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-extrabold font-mono uppercase text-black">
                Initial Plot Artwork
              </label>
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-black text-[10px] font-mono font-bold">
                <button
                  type="button"
                  onClick={() => setArtMode('color')}
                  className={`px-2 py-1 rounded transition-colors ${
                    artMode === 'color' ? 'bg-black text-white shadow-xs' : 'text-gray-700 hover:text-black'
                  }`}
                >
                  Solid Color
                </button>
                <button
                  type="button"
                  onClick={() => setArtMode('image')}
                  className={`px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                    artMode === 'image' ? 'bg-black text-white shadow-xs' : 'text-gray-700 hover:text-black'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Place Image</span>
                </button>
              </div>
            </div>

            {artMode === 'color' ? (
              <div>
                <div className="flex items-center gap-1.5 flex-wrap p-1 rounded-lg">
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
                  You can also paint custom pixel art or upload an image anytime later in Paint Studio!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-black rounded-xl cursor-pointer bg-yellow-50/50 hover:bg-yellow-50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-700 mb-1" />
                  <span className="text-xs font-bold font-mono text-black">
                    {uploadedImagePreview ? 'Change Image / Logo' : 'Choose Image / Logo to Convert'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    PNG, JPG, or SVG — Automatically converted to {pixelCount} pixels!
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </label>

                {isProcessingImage && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono font-bold text-gray-700">
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Converting image into pixel art...</span>
                  </div>
                )}

                {uploadedImagePreview && !isProcessingImage && (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 border border-black rounded-lg">
                    <img
                      src={uploadedImagePreview}
                      alt="Preview"
                      className="w-12 h-12 object-contain border border-black rounded bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-[#10AC84]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Artwork Converted!</span>
                      </div>
                      <p className="text-[10px] text-gray-600 font-mono truncate">
                        Ready to place on {regionsToBuy.length} selected {regionsToBuy.length > 1 ? 'areas' : 'area'} ({pixelCount} px)
                      </p>
                    </div>
                  </div>
                )}

                {/* If multiple areas selected, offer Span vs Fit placement options */}
                {regionsToBuy.length > 1 && (
                  <div className="p-2 bg-yellow-100/50 border border-black rounded-lg">
                    <span className="block text-[10px] font-black font-mono uppercase text-black mb-1">
                      Multi-Area Image Placement:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePlacementModeChange('span')}
                        className={`px-2 py-1 text-[10px] font-mono font-bold rounded border border-black transition-all ${
                          imagePlacementMode === 'span'
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-white text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        Panoramic / Span All
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePlacementModeChange('fit')}
                        className={`px-2 py-1 text-[10px] font-mono font-bold rounded border border-black transition-all ${
                          imagePlacementMode === 'fit'
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-white text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        Fit Into Each Area
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                className={`p-2 rounded-lg border-[1.5px] border-black flex flex-col items-center gap-1 text-[10px] font-bold font-mono transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-white shadow-[2px_2px_0px_#000] scale-102'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Credit Card / Stripe</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`p-2 rounded-lg border-[1.5px] border-black flex flex-col items-center gap-1 text-[10px] font-bold font-mono transition-all ${
                  paymentMethod === 'upi'
                    ? 'bg-white shadow-[2px_2px_0px_#000] scale-102'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <QrCode className="w-4 h-4 text-orange-600" />
                <span>UPI / Razorpay</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                className={`p-2 rounded-lg border-[1.5px] border-black flex flex-col items-center gap-1 text-[10px] font-bold font-mono transition-all ${
                  paymentMethod === 'paypal'
                    ? 'bg-white shadow-[2px_2px_0px_#000] scale-102'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <DollarSign className="w-4 h-4 text-sky-600" />
                <span>PayPal (Global)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('crypto')}
                className={`p-2 rounded-lg border-[1.5px] border-black flex flex-col items-center gap-1 text-[10px] font-bold font-mono transition-all ${
                  paymentMethod === 'crypto'
                    ? 'bg-white shadow-[2px_2px_0px_#000] scale-102'
                    : 'bg-white/60 hover:bg-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Crypto (USDC/ETH)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t-[2px] border-black">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 border-[2px] border-black rounded-xl text-xs font-black text-black transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-purchase"
            type="button"
            disabled={isProcessing}
            onClick={handlePurchase}
            className="px-5 py-2 bg-[#1DD1A1] hover:bg-emerald-300 disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] rounded-xl text-xs font-black text-black flex items-center gap-2 transition-transform"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirming Order...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Demo Purchase (${costUSD.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
