import React, { useState } from 'react';
import {
  DollarSign,
  X,
  CreditCard,
  Globe,
  Building,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  Code,
  Copy,
  Check,
} from 'lucide-react';

interface MonetizationGuideModalProps {
  onClose: () => void;
}

export const MonetizationGuideModal: React.FC<MonetizationGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'razorpay' | 'stripe' | 'paypal' | 'crypto'>('razorpay');
  const [copiedCode, setCopiedCode] = useState(false);

  const razorpayCode = `// 1. Install Razorpay in your React App:
// npm install razorpay

// 2. Client-side checkout handler in BuyPixelsModal:
const options = {
  key: "YOUR_RAZORPAY_KEY_ID", // From Razorpay Dashboard
  amount: Math.round(costUSD * 100), // in cents (USD)
  currency: "USD", // Accepts USD from USA, Europe, Global!
  name: "Million Dollar Canvas",
  description: \`Purchase of \${selection.pixelCount} Pixels\`,
  image: "https://your-app.com/logo.png",
  handler: function (response) {
    // Payment successful! Verify on server & save plot to Firestore
    savePlotToFirestore(response.razorpay_payment_id);
  },
  prefill: {
    email: user.email,
    name: user.displayName,
  },
  theme: { color: "#FFE169" }
};
const rzp = new window.Razorpay(options);
rzp.open();`;

  const stripeCode = `// 1. Create a server API route (/api/create-checkout-session):
app.post('/api/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Million Dollar Canvas Pixels' },
        unit_amount: 25, // $0.25 in cents
      },
      quantity: pixelCount,
    }],
    mode: 'payment',
    success_url: \`\${APP_URL}/?success=true&session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${APP_URL}/?canceled=true\`,
  });
  res.json({ id: session.id });
});`;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      id="monetization-guide-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-2xl w-full p-4 sm:p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#A388EE] border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 rounded-xl">
              <DollarSign className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black">
                INTERNATIONAL PAYMENTS GUIDE (INDIA)
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                How to collect international USD & receive money in your Indian bank account
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

        {/* Overview Banner */}
        <div className="bg-[#FFE169] border-[2px] border-black shadow-[3px_3px_0px_#000] p-3 rounded-xl mb-4 text-xs font-medium text-black flex items-start gap-2">
          <Globe className="w-4 h-4 text-black shrink-0 mt-0.5" />
          <div>
            <strong>You can easily collect USD, EUR, GBP globally from India!</strong> The canvas currently has <strong>Demo simulated payment</strong> active. Here are the 4 best payment gateways to connect for real international earnings:
          </div>
        </div>

        {/* Gateway Tabs */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('razorpay')}
            className={`px-3 py-1.5 rounded-xl border-[2px] border-black text-xs font-mono font-bold transition-all ${
              activeTab === 'razorpay'
                ? 'bg-[#4ECDC4] shadow-[2px_2px_0px_#000]'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            1. Razorpay International (Recommended)
          </button>
          <button
            onClick={() => setActiveTab('stripe')}
            className={`px-3 py-1.5 rounded-xl border-[2px] border-black text-xs font-mono font-bold transition-all ${
              activeTab === 'stripe'
                ? 'bg-[#4ECDC4] shadow-[2px_2px_0px_#000]'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            2. Stripe India
          </button>
          <button
            onClick={() => setActiveTab('paypal')}
            className={`px-3 py-1.5 rounded-xl border-[2px] border-black text-xs font-mono font-bold transition-all ${
              activeTab === 'paypal'
                ? 'bg-[#4ECDC4] shadow-[2px_2px_0px_#000]'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            3. PayPal Business
          </button>
          <button
            onClick={() => setActiveTab('crypto')}
            className={`px-3 py-1.5 rounded-xl border-[2px] border-black text-xs font-mono font-bold transition-all ${
              activeTab === 'crypto'
                ? 'bg-[#4ECDC4] shadow-[2px_2px_0px_#000]'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            4. Crypto (USDC / ETH)
          </button>
        </div>

        {/* Tab Contents */}
        <div className="bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] p-4 rounded-xl max-h-[320px] overflow-y-auto text-xs space-y-3">
          {activeTab === 'razorpay' && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-sm text-black">
                  RAZORPAY INTERNATIONAL PAYMENTS
                </span>
                <span className="bg-[#10AC84] text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  BEST FOR INDIA
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">
                Razorpay is headquartered in Bangalore and allows Indian individuals and businesses to accept payments in <strong>USD, EUR, GBP, AUD</strong> via international cards (Visa, Mastercard, Amex).
              </p>

              <div className="bg-[#FAF8F5] border border-black p-3 rounded-lg space-y-1.5 font-mono text-[11px]">
                <div className="font-bold text-black uppercase">How it works:</div>
                <div>1. Create a free account at <strong>razorpay.com</strong> with your PAN & Indian Bank details.</div>
                <div>2. Go to <strong>Settings → International Payments</strong> and enable it (takes 24-48 hrs).</div>
                <div>3. Razorpay charges ~3% + ₹3 per international transaction.</div>
                <div>4. Money is auto-converted to INR and deposited into your Indian Bank account (T+3 days).</div>
                <div>5. Provides automatic <strong>e-FIRC</strong> (Foreign Inward Remittance Certificate) for RBI compliance.</div>
              </div>

              <div className="relative mt-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-600 mb-1">
                  <span>Integration Code Snippet:</span>
                  <button
                    onClick={() => copyCode(razorpayCode)}
                    className="flex items-center gap-1 text-black font-bold hover:underline"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto">
                  {razorpayCode}
                </pre>
              </div>
            </>
          )}

          {activeTab === 'stripe' && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-sm text-black">STRIPE INDIA</span>
                <span className="bg-[#54A0FF] text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  GLOBAL FAVORITE
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">
                Stripe operates in India and supports international credit cards, Apple Pay, and Google Pay in 135+ currencies.
              </p>
              <div className="bg-[#FAF8F5] border border-black p-3 rounded-lg space-y-1.5 font-mono text-[11px]">
                <div className="font-bold text-black uppercase">Prerequisites:</div>
                <div>• Indian Individual PAN or Private Limited / LLP company.</div>
                <div>• Export Purpose Code: <strong>P0802</strong> (Software consultancy / digital art).</div>
                <div>• Automatic daily or weekly bank payout to any Indian bank account (HDFC, ICICI, SBI).</div>
              </div>
              <div className="relative mt-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-600 mb-1">
                  <span>Server API Route:</span>
                  <button
                    onClick={() => copyCode(stripeCode)}
                    className="flex items-center gap-1 text-black font-bold hover:underline"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto">
                  {stripeCode}
                </pre>
              </div>
            </>
          )}

          {activeTab === 'paypal' && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-sm text-black">PAYPAL FOR BUSINESS (INDIA)</span>
                <span className="bg-[#5F27CD] text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  NO CODE NEEDED
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">
                PayPal is recognized by millions of international buyers who prefer not to enter card details on new websites.
              </p>
              <div className="bg-[#FAF8F5] border border-black p-3 rounded-lg space-y-1.5 font-mono text-[11px]">
                <div>• Sign up for a PayPal India Business Account.</div>
                <div>• Link your Indian Bank account and verify with micro-deposits.</div>
                <div>• RBI mandates automatic auto-sweep: all USD funds in PayPal are auto-transferred to your Indian bank daily!</div>
                <div>• You can drop in the PayPal Smart Button JS SDK in 15 minutes.</div>
              </div>
            </>
          )}

          {activeTab === 'crypto' && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-sm text-black">CRYPTO / USDC (WEB3)</span>
                <span className="bg-[#FFA97A] text-black px-2 py-0.5 rounded text-[10px] font-bold border border-black">
                  BORDERLESS
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">
                Since this is an online digital pixel canvas, international crypto artists love paying with USDC, Ethereum, or Solana.
              </p>
              <div className="bg-[#FAF8F5] border border-black p-3 rounded-lg space-y-1.5 font-mono text-[11px]">
                <div>• Zero foreign wire fees, instant global confirmation.</div>
                <div>• Connect via Coinbase Commerce or direct Web3 wallet (MetaMask / Phantom).</div>
                <div>• Withdraw INR via Indian exchanges (CoinDCX, WazirX) or P2P.</div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-3 border-t-[2px] border-black flex items-center justify-between">
          <span className="text-[11px] font-mono text-gray-500 font-bold">
            Demo checkout is fully testable right now!
          </span>
          <button
            onClick={onClose}
            className="bg-black hover:bg-gray-800 text-white border-[2px] border-black shadow-[2px_2px_0px_#000] px-4 py-1.5 rounded-xl text-xs font-bold"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
