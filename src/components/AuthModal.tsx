import React, { useState } from 'react';
import {
  X,
  LogIn,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  Zap,
  ArrowRight,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInGuest,
  AppUser,
} from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: FirebaseUser | AppUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEmailProviderNotice, setShowEmailProviderNotice] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setShowEmailProviderNotice(false);
    try {
      const user = await signInWithGoogle();
      if (user) {
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      console.warn('Google sign-in status:', err);
      if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Browser blocked the sign-in popup. Please allow popups or use Instant Guest Mode below.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed before completing. Click Continue with Google to try again.');
      } else {
        setErrorMsg(err.message || 'Google sign-in could not be completed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setShowEmailProviderNotice(false);
    try {
      let user: FirebaseUser;
      if (tab === 'signin') {
        user = await signInWithEmail(email, password);
      } else {
        user = await signUpWithEmail(email, password);
      }
      onSuccess(user);
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        // Email/Password provider is not activated in this Firebase project
        setShowEmailProviderNotice(true);
        setErrorMsg(
          'Email/Password login is not enabled in this Firebase project. Google Sign-In is configured and ready.'
        );
      } else if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setErrorMsg('Invalid email or password. Please double-check your credentials.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Please switch to the Sign In tab.');
      } else {
        setErrorMsg(err.message || 'Authentication could not be completed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await signInGuest();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.warn('Notice during guest sign-in, creating guest session:', err);
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

  // Continue with entered email as instant demo session if Email Auth provider is not enabled in project
  const handleDemoEmailSignIn = () => {
    const cleanEmail = email.trim() || 'artist@canvas.io';
    const guestUser: AppUser = {
      uid: 'demo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      displayName: cleanEmail.split('@')[0],
      email: cleanEmail,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
      isAnonymous: true,
    };
    onSuccess(guestUser);
    onClose();
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-md w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b-[2px] border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#FFE169] border-[2px] border-black shadow-[2px_2px_0px_#000] p-2 rounded-xl">
              <LogIn className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black">
                SIGN IN TO CANVAS
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                Claim pixels, paint artwork & track your plots
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
          <div className="mb-4 bg-red-50 border-[2px] border-red-800 text-red-900 text-xs font-bold p-3 rounded-xl flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMsg}</span>
              </div>
            </div>

            {showEmailProviderNotice && (
              <div className="mt-1 pt-2 border-t border-red-200 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="bg-white hover:bg-yellow-50 text-black border-[2px] border-black shadow-[2px_2px_0px_#000] px-3 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Use Configured Google Sign-In</span>
                </button>
                <button
                  type="button"
                  onClick={handleDemoEmailSignIn}
                  className="bg-[#A388EE] hover:bg-purple-300 text-black border-[2px] border-black shadow-[2px_2px_0px_#000] px-3 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>Continue with this email account</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Option 1: One-Click Google Sign-In (Primary & Configured in Firebase) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black font-mono uppercase text-gray-600">
              Recommended Method
            </span>
            <span className="text-[9px] bg-green-200 text-green-800 font-extrabold px-1.5 py-0.5 rounded border border-green-700 font-mono">
              Firebase Configured
            </span>
          </div>
          <button
            id="btn-auth-google"
            type="button"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            className="w-full bg-white hover:bg-yellow-50 active:translate-x-0.5 active:translate-y-0.5 border-[2.5px] border-black shadow-[3px_3px_0px_#000] py-3 px-4 rounded-xl font-black text-xs sm:text-sm text-black flex items-center justify-center gap-2.5 transition-all cursor-pointer"
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
        </div>

        {/* Option 2: Instant Guest Testing Mode */}
        <div className="mb-4 bg-[#F2EDE4] border-[2px] border-black rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black font-mono uppercase text-gray-700 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-600" /> Instant Sandbox Mode
            </span>
            <span className="text-[9px] text-gray-500 font-mono">No password required</span>
          </div>
          <button
            id="btn-auth-guest"
            type="button"
            disabled={isLoading}
            onClick={handleInstantSignIn}
            className="w-full bg-[#A388EE] hover:bg-purple-300 disabled:opacity-50 border-[2px] border-black shadow-[2px_2px_0px_#000] py-2 px-3 rounded-xl text-xs font-black text-black flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-black" />
            <span>Explore as Instant Guest Artist</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-3.5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/20" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono font-bold">
            <span className="bg-[#FAF8F5] px-2 text-gray-500">Optional: Email & Password</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-200 border-[2px] border-black rounded-xl p-1 mb-3">
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              setErrorMsg(null);
              setShowEmailProviderNotice(false);
            }}
            className={`flex-1 py-1 text-xs font-extrabold rounded-lg transition-all ${
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
              setShowEmailProviderNotice(false);
            }}
            className={`flex-1 py-1 text-xs font-extrabold rounded-lg transition-all ${
              tab === 'signup'
                ? 'bg-[#FFE169] text-black border border-black shadow-[1px_1px_0px_#000]'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
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
                className="w-full pl-9 pr-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold focus:bg-yellow-50 focus:outline-hidden"
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
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold focus:bg-yellow-50 focus:outline-hidden"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#4ECDC4] hover:bg-teal-300 disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] py-2 rounded-xl text-xs font-black text-black flex items-center justify-center gap-1.5 transition-transform cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking credentials...</span>
              </>
            ) : tab === 'signin' ? (
              <span>Sign In with Email</span>
            ) : (
              <span>Create Account with Email</span>
            )}
          </button>
        </form>

        {/* Small informational footer */}
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
          <Info className="w-3 h-3 shrink-0 text-gray-400" />
          <span>Google Sign-In is provisioned for this canvas.</span>
        </div>
      </div>
    </div>
  );
};

