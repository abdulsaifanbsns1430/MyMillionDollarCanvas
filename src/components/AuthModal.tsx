import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Copy,
  Check,
  RotateCw,
  Info,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInGuest,
  sendEmailOTP,
  verifyEmailOTP,
  AppUser,
} from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: FirebaseUser | AppUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // 6-digit OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [hasCopiedOtp, setHasCopiedOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // References for OTP inputs to handle auto-focus
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Step 1: Submit email & password to generate OTP
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await sendEmailOTP(cleanEmail, password, tab);
      setGeneratedOtp(result.otp);
      setSuccessMsg(result.message);
      setResendCooldown(60);
      setStep('otp');
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to proceed with email authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP input changes & auto-advance
  const handleOtpChange = (index: number, val: string) => {
    // Only accept numbers
    const cleanVal = val.replace(/[^0-9]/g, '');
    if (!cleanVal && val !== '') return;

    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Support pasting full 6-digit OTP
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Auto-fill OTP button
  const handleAutoFillOtp = () => {
    if (!generatedOtp || generatedOtp.length !== 6) return;
    const split = generatedOtp.split('');
    setOtpDigits(split);
    inputRefs.current[5]?.focus();
  };

  // Copy OTP code to clipboard
  const handleCopyOtp = () => {
    if (!generatedOtp) return;
    navigator.clipboard.writeText(generatedOtp);
    setHasCopiedOtp(true);
    setTimeout(() => setHasCopiedOtp(false), 2000);
  };

  // Resend fresh OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await sendEmailOTP(email.trim(), password, tab);
      setGeneratedOtp(result.otp);
      setSuccessMsg('A new OTP has been dispatched to your email.');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and complete authentication
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = otpDigits.join('');
    if (enteredCode.length !== 6) {
      setErrorMsg('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const user = await verifyEmailOTP(email.trim(), enteredCode, password, tab);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      console.warn('Google sign-in status:', err);
      if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Sign-in popup was blocked by your browser. Please allow popups or use Email + OTP login below.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed. Click Continue with Google to try again or use Email + OTP below.');
      } else {
        setErrorMsg(err.message || 'Google sign-in could not be completed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Instant Guest Testing Mode
  const handleInstantSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await signInGuest();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.warn('Guest sign-in notice:', err);
      const fallbackUser: AppUser = {
        uid: 'guest_' + Date.now(),
        displayName: 'Guest Artist',
        email: null,
        photoURL: null,
        isAnonymous: true,
      };
      onSuccess(fallbackUser);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-md w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-2 border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#FFE169] border-[2px] border-black shadow-[2px_2px_0px_#000] p-2 rounded-xl">
              {step === 'otp' ? (
                <KeyRound className="w-5 h-5 text-black" />
              ) : (
                <LogIn className="w-5 h-5 text-black" />
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black uppercase">
                {step === 'otp' ? 'VERIFY EMAIL OTP' : 'SIGN IN TO CANVAS'}
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                {step === 'otp'
                  ? 'Confirm your 6-digit one-time password'
                  : 'Claim pixels, paint artwork & track your plots'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-black hover:bg-black/10 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 bg-red-50 border-[2px] border-red-800 text-red-900 text-xs font-bold p-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && !errorMsg && (
          <div className="mb-4 bg-emerald-50 border-[2px] border-emerald-800 text-emerald-900 text-xs font-bold p-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: CREDENTIALS (Email & Password) */}
        {/* ========================================================= */}
        {step === 'credentials' ? (
          <div>
            {/* Tab Switcher: Sign In vs Create Account */}
            <div className="flex bg-gray-200 border-[2px] border-black rounded-xl p-1 mb-4">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-1.5 text-xs font-extrabold font-mono rounded-lg transition-all cursor-pointer ${
                  tab === 'signin'
                    ? 'bg-[#FFE169] text-black border border-black shadow-[1px_1px_0px_#000]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-1.5 text-xs font-extrabold font-mono rounded-lg transition-all cursor-pointer ${
                  tab === 'signup'
                    ? 'bg-[#FFE169] text-black border border-black shadow-[1px_1px_0px_#000]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5 mb-4">
              <div>
                <label className="block text-[11px] font-extrabold font-mono uppercase text-black mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="artist@canvas.io"
                    className="w-full pl-9 pr-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold text-black focus:bg-yellow-50 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold font-mono uppercase text-black mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-9 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold text-black focus:bg-yellow-50 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-black cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-auth-email-otp"
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#4ECDC4] hover:bg-teal-300 disabled:opacity-60 active:translate-x-0.5 active:translate-y-0.5 border-[2.5px] border-black shadow-[3px_3px_0px_#000] py-2.5 rounded-xl text-xs font-black text-black flex items-center justify-center gap-2 transition-transform cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Security OTP...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {tab === 'signin'
                        ? 'Continue to Email OTP'
                        : 'Create Account & Send OTP'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/20" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono font-bold">
                <span className="bg-[#FAF8F5] px-2 text-gray-500">Other Sign-In Options</span>
              </div>
            </div>

            {/* Google Sign-In */}
            <button
              id="btn-auth-google"
              type="button"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full mb-3 bg-white hover:bg-yellow-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2px_2px_0px_#000] py-2.5 px-4 rounded-xl font-black text-xs text-black flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Instant Sandbox Guest Mode */}
            <button
              id="btn-auth-guest"
              type="button"
              disabled={isLoading}
              onClick={handleInstantSignIn}
              className="w-full bg-[#A388EE]/30 hover:bg-[#A388EE]/50 border-[2px] border-black shadow-[2px_2px_0px_#000] py-2 px-3 rounded-xl text-xs font-black text-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-purple-700" />
              <span>Explore as Instant Guest Artist</span>
            </button>
          </div>
        ) : (
          /* ========================================================= */
          /* STEP 2: OTP VERIFICATION */
          /* ========================================================= */
          <div>
            {/* Back button and target email header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setErrorMsg(null);
                }}
                className="flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-black cursor-pointer font-mono"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit email or password</span>
              </button>
              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                Step 2 of 2
              </span>
            </div>

            {/* Prominent Live OTP Notification Card */}
            <div className="bg-[#FFE169]/40 border-[2.5px] border-black rounded-xl p-3.5 mb-4 shadow-[3px_3px_0px_#000]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black font-mono uppercase tracking-wider text-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Email OTP Security Dispatch
                </span>
                <span className="text-[9px] font-mono bg-white px-1.5 py-0.5 rounded border border-black font-bold">
                  Sent to {email}
                </span>
              </div>

              {generatedOtp && (
                <div className="bg-white border-[2px] border-black rounded-lg p-2.5 flex items-center justify-between gap-2 mt-2">
                  <div>
                    <div className="text-[10px] text-gray-600 font-mono">Your 6-Digit Passcode:</div>
                    <div className="text-xl font-black font-mono tracking-widest text-black">
                      {generatedOtp}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyOtp}
                      className="bg-gray-100 hover:bg-gray-200 border border-black p-1.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy OTP"
                    >
                      {hasCopiedOtp ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-black" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoFillOtp}
                      className="bg-[#10AC84] hover:bg-emerald-600 text-white border border-black px-2 py-1.5 rounded-md text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Auto-Fill</span>
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-600 font-mono mt-2">
                Stored in secure Firebase verification collection. Code expires in 10 minutes.
              </p>
            </div>

            {/* 6-Digit Input Box Grid */}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold font-mono uppercase text-black mb-2 text-center">
                  Enter 6-Digit Verification Code
                </label>
                <div className="flex justify-between gap-1.5 sm:gap-2" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-black font-mono bg-white border-[2.5px] border-black rounded-xl shadow-[2px_2px_0px_#000] focus:bg-yellow-100 focus:outline-hidden"
                    />
                  ))}
                </div>
              </div>

              {/* Verify & Sign In Button */}
              <button
                id="btn-verify-otp"
                type="submit"
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full bg-[#10AC84] hover:bg-emerald-500 disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 border-[2.5px] border-black shadow-[3px_3px_0px_#000] py-3 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2 transition-transform cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Verify & Sign In to Canvas</span>
                  </>
                )}
              </button>

              {/* Resend Code Section */}
              <div className="flex items-center justify-between pt-2 text-xs font-mono">
                <span className="text-gray-600">Didn't receive the code?</span>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoading}
                  onClick={handleResendOtp}
                  className="font-bold text-black hover:underline disabled:text-gray-400 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? (
                    <span>Resend in {resendCooldown}s</span>
                  ) : (
                    <span>Resend OTP</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Small informational footer */}
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
          <Info className="w-3 h-3 shrink-0 text-gray-400" />
          <span>Real-time persistence powered by Firebase Firestore.</span>
        </div>
      </div>
    </div>
  );
};
