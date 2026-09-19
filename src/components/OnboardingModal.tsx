import React, { useState, useEffect } from 'react';
import { User, ShieldCheck, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import { checkUsernameAvailable, createUserProfile } from '../lib/firebase';
import { UserProfile } from '../types';

interface OnboardingModalProps {
  rawUser: any;
  onComplete: (profile: UserProfile) => void;
  onCancel: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  rawUser,
  onComplete,
  onCancel,
}) => {
  const [username, setUsername] = useState('');
  const [profileId, setProfileId] = useState('');
  const [displayName, setDisplayName] = useState(rawUser?.displayName || '');
  const [bio, setBio] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-generate profile ID (e.g. #PX-8492)
  useEffect(() => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setProfileId(`#PX-${randomDigits}`);

    // If user has email or name, suggest initial username
    if (rawUser?.email) {
      const initial = rawUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      if (initial.length >= 3) {
        setUsername(initial);
      }
    }
  }, [rawUser]);

  // Debounced check for username availability
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (clean.length < 3) {
      setIsAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const available = await checkUsernameAvailable(clean);
        setIsAvailable(available);
      } catch {
        setIsAvailable(true);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanProfileId = profileId.trim().toUpperCase();

    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setErrorMsg('Username can only contain letters, numbers, and underscores.');
      return;
    }

    if (!cleanProfileId) {
      setErrorMsg('Profile ID is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Re-verify availability
      const available = await checkUsernameAvailable(cleanUsername);
      if (!available) {
        setErrorMsg(`Username @${cleanUsername} is already taken. Please choose another.`);
        setIsSubmitting(false);
        return;
      }

      const newProfile = await createUserProfile(rawUser.uid, {
        username: cleanUsername,
        profileId: cleanProfileId,
        displayName: displayName || cleanUsername,
        email: rawUser.email || '',
        photoURL: rawUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
        bio,
      });

      onComplete(newProfile);
    } catch (err: any) {
      console.error('Failed to create profile:', err);
      setErrorMsg('Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="onboarding-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FAF8F5] border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 border-b-[2px] border-black pb-4">
          <div className="bg-[#FFE169] border-[2px] border-black shadow-[2px_2px_0px_#000] p-2 rounded-xl">
            <Sparkles className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="font-extrabold text-xl font-mono text-black">
              CLAIM YOUR PIXEL IDENTITY
            </h2>
            <p className="text-xs text-gray-600">
              Create your permanent profile before claiming canvas territory.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-100 border-[2px] border-black text-red-800 text-xs font-bold p-2.5 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Unique Username */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black font-mono uppercase text-black">
                Unique Username *
              </label>
              {isCheckingUsername ? (
                <span className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Checking...
                </span>
              ) : isAvailable === true ? (
                <span className="text-[10px] text-green-700 font-bold flex items-center gap-1 font-mono">
                  <Check className="w-3 h-3" /> Available
                </span>
              ) : isAvailable === false ? (
                <span className="text-[10px] text-red-600 font-bold font-mono">
                  Already Taken
                </span>
              ) : null}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 font-mono font-bold text-sm">
                @
              </span>
              <input
                id="input-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="cyberartist"
                className="w-full pl-8 pr-3 py-2 bg-white border-[2px] border-black rounded-xl text-sm font-mono font-bold focus:bg-yellow-50 focus:outline-hidden"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1 font-mono">
              Letters, numbers, underscores (3–20 chars). Stored as your unique identity.
            </p>
          </div>

          {/* Unique Profile ID */}
          <div>
            <label className="block text-xs font-black font-mono uppercase text-black mb-1">
              Unique Profile ID *
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-profile-id"
                type="text"
                required
                value={profileId}
                onChange={(e) => setProfileId(e.target.value.toUpperCase())}
                placeholder="#PX-9921"
                className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-sm font-mono font-bold uppercase focus:bg-yellow-50 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setProfileId(`#PX-${Math.floor(1000 + Math.random() * 9000)}`)}
                className="shrink-0 bg-[#A388EE] hover:bg-purple-300 border-[2px] border-black shadow-[2px_2px_0px_#000] px-2.5 py-2 rounded-xl text-xs font-bold font-mono"
              >
                Randomize
              </button>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-black font-mono uppercase text-black mb-1">
              Display Name (Optional)
            </label>
            <input
              id="input-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Satoshi Nakamoto"
              className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-sm font-bold focus:bg-yellow-50 focus:outline-hidden"
            />
          </div>

          {/* Bio / Motto */}
          <div>
            <label className="block text-xs font-black font-mono uppercase text-black mb-1">
              Artist Bio / Canvas Motto
            </label>
            <input
              id="input-bio"
              type="text"
              maxLength={120}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Building the digital frontier, one pixel at a time."
              className="w-full px-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs focus:bg-yellow-50 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="bg-white hover:bg-gray-100 border-[2px] border-black shadow-[2px_2px_0px_#000] px-4 py-2 rounded-xl text-xs font-extrabold text-black"
            >
              Cancel
            </button>
            <button
              id="btn-submit-onboarding"
              type="submit"
              disabled={isSubmitting || isAvailable === false}
              className="bg-[#4ECDC4] hover:bg-teal-300 disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[3px_3px_0px_#000] px-5 py-2 rounded-xl text-xs font-black text-black flex items-center gap-1.5 transition-transform"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering Profile...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Profile & Enter</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
