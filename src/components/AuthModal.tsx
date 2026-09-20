import React, { useState } from 'react';
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
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  User,
} from 'lucide-react';
import {
  signInWithGoogle,
  loginWithIdentifierAndPassword,
  getGoogleAccountStatus,
  verifyAccountPassword,
  checkAccountExists,
  fbSignOut,
  auth,
  AppUser,
} from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: FirebaseUser | AppUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  
  // Sign In inputs (Identifier: email or registered username)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up inputs
  const [signupEmail, setSignupEmail] = useState('');

  // Google pending password verification state
  const [googlePendingUser, setGooglePendingUser] = useState<FirebaseUser | null>(null);
  const [googlePassword, setGooglePassword] = useState('');
  const [showGooglePassword, setShowGooglePassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDomainHelp, setShowDomainHelp] = useState(false);

  // Handle direct Sign In with email or registered username + password (No OTP required)
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();

    if (!cleanId) {
      setErrorMsg('Please enter your registered email address or username.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const user = await loginWithIdentifierAndPassword(cleanId, password);
      setSuccessMsg('Sign in successful! Entering canvas...');
      setTimeout(() => {
        onSuccess(user);
        onClose();
      }, 350);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Sign Up initiation (Check for duplicate email first)
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = signupEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const alreadyRegistered = await checkAccountExists(cleanEmail);
      if (alreadyRegistered) {
        setErrorMsg(
          'This email address is already registered. You cannot create a duplicate account with this email. Please switch to Sign In.'
        );
        setIsLoading(false);
        return;
      }

      // Proceed directly to identity & password setup
      const newUid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const appUser: AppUser = {
        uid: newUid,
        displayName: null,
        email: cleanEmail,
        photoURL: null,
        isAnonymous: false,
      };

      try {
        localStorage.setItem('million_canvas_active_user', JSON.stringify(appUser));
      } catch {}

      onSuccess(appUser);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In with mandatory password check for existing accounts
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setShowDomainHelp(false);

    try {
      const user = await signInWithGoogle();
      if (!user) return;

      const userEmail = user.email ? user.email.toLowerCase() : '';
      if (!userEmail) {
        onSuccess(user);
        onClose();
        return;
      }

      // Check if this account already has an established password in Firebase
      const status = await getGoogleAccountStatus(userEmail);

      if (status.hasPassword) {
        // User already has a registered password -> require password verification before granting access
        setGooglePendingUser(user);
        setIsLoading(false);
      } else {
        // First-time Google user -> proceed to onboarding to choose unique username and create password
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setShowDomainHelp(true);
        setErrorMsg(
          `Firebase Google Sign-In requires "${window.location.hostname}" to be whitelisted under Authorized Domains in Firebase Console. You can also sign in or register with Email/Username below immediately!`
        );
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Sign-in popup was blocked by your browser. Please allow popups or use Email/Username.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in was cancelled.');
      } else {
        setErrorMsg(err.message || 'Google sign-in could not be completed.');
      }
      setIsLoading(false);
    }
  };

  // Verify password for Google authenticated user
  const handleVerifyGooglePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googlePendingUser || !googlePendingUser.email) return;

    if (!googlePassword) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await verifyAccountPassword(googlePendingUser.email, googlePassword);
      try {
        sessionStorage.setItem('google_pass_verified_' + googlePendingUser.uid, 'true');
      } catch {}
      setSuccessMsg('Password verified! Entering canvas...');
      setTimeout(() => {
        onSuccess(googlePendingUser);
        onClose();
      }, 350);
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect password. Access denied.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel Google password check and sign out
  const handleCancelGooglePassword = async () => {
    try {
      if (googlePendingUser) {
        sessionStorage.removeItem('google_pass_verified_' + googlePendingUser.uid);
      }
      await fbSignOut(auth);
      localStorage.removeItem('million_canvas_active_user');
      localStorage.removeItem('million_canvas_active_profile');
    } catch {}
    setGooglePendingUser(null);
    setGooglePassword('');
    setErrorMsg(null);
  };

  // Close entire modal
  const handleCloseModal = async () => {
    if (googlePendingUser) {
      await handleCancelGooglePassword();
    }
    onClose();
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
              {googlePendingUser ? (
                <Lock className="w-5 h-5 text-black" />
              ) : tab === 'signup' ? (
                <UserPlus className="w-5 h-5 text-black" />
              ) : (
                <LogIn className="w-5 h-5 text-black" />
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl font-mono text-black uppercase">
                {googlePendingUser
                  ? 'VERIFY ACCOUNT PASSWORD'
                  : tab === 'signup'
                  ? 'CREATE ARTIST ACCOUNT'
                  : 'SIGN IN TO CANVAS'}
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                {googlePendingUser
                  ? 'Enter password to unlock your Google session'
                  : tab === 'signup'
                  ? 'Register with email to claim canvas territory'
                  : 'Log in with your username or email & password'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="text-black hover:bg-black/10 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 bg-red-50 border-[2px] border-red-800 text-red-900 text-xs font-bold p-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span>{errorMsg}</span>
              {errorMsg.includes('already registered') && tab === 'signup' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier(signupEmail);
                      setTab('signin');
                      setErrorMsg(null);
                    }}
                    className="underline text-black font-extrabold hover:text-red-950 cursor-pointer"
                  >
                    → Click here to Switch to Sign In
                  </button>
                </div>
              )}
              {errorMsg.includes('create an account') && tab === 'signin' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (identifier.includes('@')) {
                        setSignupEmail(identifier);
                      }
                      setTab('signup');
                      setErrorMsg(null);
                    }}
                    className="underline text-black font-extrabold hover:text-red-950 cursor-pointer"
                  >
                    → Click here to Create New Account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Domain Whitelist Help */}
        {showDomainHelp && (
          <div className="mb-4 bg-amber-50 border-[2px] border-amber-800 text-amber-900 text-xs p-3 rounded-xl space-y-1.5 font-mono">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Google Sign-In Domain Configuration:</span>
            </div>
            <p className="text-[11px] text-gray-700">
              In Firebase Console → Authentication → Settings → Authorized Domains, add:
            </p>
            <code className="block bg-white p-1.5 rounded border border-amber-300 font-bold select-all text-black">
              {window.location.hostname}
            </code>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && (
          <div className="mb-4 bg-emerald-50 border-[2px] border-emerald-800 text-emerald-900 text-xs font-bold p-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CASE A: GOOGLE PENDING PASSWORD VERIFICATION */}
        {/* ========================================================= */}
        {googlePendingUser ? (
          <form onSubmit={handleVerifyGooglePassword} className="space-y-4">
            <div className="bg-[#FFE169]/30 border-[2px] border-black p-3 rounded-xl">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-black mb-1">
                <span>Google Account Verified:</span>
                <span className="text-green-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ready
                </span>
              </div>
              <div className="text-xs font-mono font-black text-gray-800 break-all">
                {googlePendingUser.email}
              </div>
              <p className="text-[10px] text-gray-600 font-mono mt-1.5">
                For heightened security, enter your account password to unlock your canvas session.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold font-mono uppercase text-black mb-1">
                Account Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type={showGooglePassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={googlePassword}
                  onChange={(e) => setGooglePassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full pl-9 pr-9 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold text-black focus:bg-yellow-50 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowGooglePassword(!showGooglePassword)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-black cursor-pointer"
                >
                  {showGooglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelGooglePassword}
                disabled={isLoading}
                className="flex-1 bg-white hover:bg-gray-100 border-[2px] border-black shadow-[2px_2px_0px_#000] py-2.5 rounded-xl text-xs font-extrabold text-black cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-2 bg-[#4ECDC4] hover:bg-teal-300 disabled:opacity-60 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] py-2.5 rounded-xl text-xs font-black text-black flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Enter</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ========================================================= */
          /* CASE B: STANDARD SIGN IN OR CREATE ACCOUNT */
          /* ========================================================= */
          <div>
            {/* Tab Switcher */}
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

            {/* TAB 1: SIGN IN (EMAIL OR USERNAME + PASSWORD, NO OTP) */}
            {tab === 'signin' ? (
              <form onSubmit={handleSignInSubmit} className="space-y-3.5 mb-4">
                <div>
                  <label className="block text-[11px] font-extrabold font-mono uppercase text-black mb-1">
                    Email Address or Username *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                    <input
                      id="input-login-identifier"
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="artist@canvas.io or @username"
                      className="w-full pl-9 pr-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold text-black focus:bg-yellow-50 focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">
                    Enter either your registered email or @username.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-extrabold font-mono uppercase text-black">
                      Account Password *
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                    <input
                      id="input-login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
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
                  id="btn-submit-signin"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#4ECDC4] hover:bg-teal-300 disabled:opacity-60 active:translate-x-0.5 active:translate-y-0.5 border-[2.5px] border-black shadow-[3px_3px_0px_#000] py-2.5 rounded-xl text-xs font-black text-black flex items-center justify-center gap-2 transition-transform cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Canvas</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* TAB 2: CREATE ACCOUNT (EMAIL -> ONBOARDING) */
              <form onSubmit={handleSignUpSubmit} className="space-y-3.5 mb-4">
                <div>
                  <label className="block text-[11px] font-extrabold font-mono uppercase text-black mb-1">
                    Your Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                    <input
                      id="input-signup-email"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="artist@canvas.io"
                      className="w-full pl-9 pr-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold text-black focus:bg-yellow-50 focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">
                    On the next screen, you'll choose your unique username, display name, and account password.
                  </p>
                </div>

                <button
                  id="btn-submit-signup"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#FFE169] hover:bg-yellow-300 disabled:opacity-60 active:translate-x-0.5 active:translate-y-0.5 border-[2.5px] border-black shadow-[3px_3px_0px_#000] py-2.5 rounded-xl text-xs font-black text-black flex items-center justify-center gap-2 transition-transform cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Profile & Password Setup</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/20" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono font-bold">
                <span className="bg-[#FAF8F5] px-2 text-gray-500">Or continue with Google</span>
              </div>
            </div>

            {/* Google Sign-In */}
            <button
              id="btn-auth-google"
              type="button"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full bg-white hover:bg-yellow-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2px_2px_0px_#000] py-2.5 px-4 rounded-xl font-black text-xs text-black flex items-center justify-center gap-2.5 transition-all cursor-pointer"
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
        )}

        {/* Small informational footer */}
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-[10px] text-gray-500 font-mono">
          <span>Encrypted with SHA-256</span>
          <span>Cloud Firestore Persistence</span>
        </div>
      </div>
    </div>
  );
};
