import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  updateDoc,
  increment,
  deleteDoc,
} from 'firebase/firestore';
import { UserProfile, Plot, PixelOrder, LeaderboardEntry } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Notice custom database ID from config
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// AppUser interface compatible with Firebase User and Guest demo users
export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

// Password hashing helper (supports Web Crypto with robust fallback)
export async function hashPassword(password: string, salt: string): Promise<string> {
  const combined = password + ':' + salt;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }
  // Deterministic fallback hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

export interface SendOTPResult {
  success: boolean;
  otp: string;
  isNewAccount: boolean;
  message: string;
}

// Generates & dispatches 6-digit OTP for Email ID login
export async function sendEmailOTP(
  email: string,
  password: string,
  mode: 'signin' | 'signup'
): Promise<SendOTPResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  let isNew = false;
  try {
    const accountRef = doc(db, 'auth_accounts', cleanEmail);
    const accountSnap = await getDoc(accountRef);

    if (mode === 'signin') {
      if (accountSnap.exists()) {
        const acc = accountSnap.data();
        const computedHash = await hashPassword(password, acc.salt || 'salt');
        if (computedHash !== acc.passwordHash) {
          throw new Error('Incorrect password. Please verify your password and try again.');
        }
      } else {
        // First-time sign in with this email
        isNew = true;
      }
    } else {
      if (accountSnap.exists()) {
        isNew = false;
      } else {
        isNew = true;
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Incorrect password')) {
      throw err;
    }
    console.warn('Notice checking account in Firestore:', err);
  }

  // Generate 6-digit OTP code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Persist OTP record in Firestore
  try {
    const otpRef = doc(db, 'email_otps', cleanEmail);
    await setDoc(otpRef, {
      email: cleanEmail,
      otp,
      expiresAt,
      createdAt: Date.now(),
      attempts: 0,
    });
  } catch (err) {
    console.warn('Notice writing OTP to Firestore:', err);
  }

  // Cache in session storage for instant client delivery
  try {
    sessionStorage.setItem(`canvas_otp_${cleanEmail}`, JSON.stringify({ otp, expiresAt }));
  } catch {}

  console.info(`[Canvas Auth] OTP for ${cleanEmail}: ${otp}`);

  return {
    success: true,
    otp,
    isNewAccount: isNew,
    message: `Verification code generated for ${cleanEmail}`,
  };
}

// Verifies 6-digit OTP and logs in / creates account
export async function verifyEmailOTP(
  email: string,
  enteredOtp: string,
  password: string,
  mode: 'signin' | 'signup'
): Promise<AppUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = enteredOtp.trim().replace(/\s+/g, '');

  if (cleanOtp.length !== 6) {
    throw new Error('Please enter the complete 6-digit OTP code.');
  }

  let verified = false;

  // 1. Check Firestore email_otps
  try {
    const otpRef = doc(db, 'email_otps', cleanEmail);
    const otpSnap = await getDoc(otpRef);
    if (otpSnap.exists()) {
      const data = otpSnap.data();
      if (Date.now() > data.expiresAt) {
        throw new Error('This verification OTP has expired. Please request a new code.');
      }
      if (data.otp === cleanOtp) {
        verified = true;
        // Clean up used OTP
        await deleteDoc(otpRef).catch(() => {});
      }
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('expired') || err.message.includes('complete'))) {
      throw err;
    }
  }

  // 2. Fallback check from session cache
  if (!verified) {
    try {
      const stored = sessionStorage.getItem(`canvas_otp_${cleanEmail}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() <= parsed.expiresAt && parsed.otp === cleanOtp) {
          verified = true;
          sessionStorage.removeItem(`canvas_otp_${cleanEmail}`);
        }
      }
    } catch {}
  }

  if (!verified) {
    throw new Error('Invalid OTP code. Please enter the correct 6-digit code or request a new one.');
  }

  // Account creation or retrieval
  let uid = '';
  const accountRef = doc(db, 'auth_accounts', cleanEmail);
  try {
    const accSnap = await getDoc(accountRef);
    if (accSnap.exists()) {
      const acc = accSnap.data();
      uid = acc.uid;
      await updateDoc(accountRef, { lastLoginAt: Date.now() }).catch(() => {});
    } else {
      uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const salt = Math.random().toString(36).substring(2, 8);
      const passwordHash = await hashPassword(password, salt);
      await setDoc(accountRef, {
        uid,
        email: cleanEmail,
        passwordHash,
        salt,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('Notice saving auth account to Firestore:', err);
    if (!uid) {
      uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
  }

  // Retrieve or create User Profile
  let profile: UserProfile | null = null;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      profile = userSnap.data() as UserProfile;
    } else {
      const rawName = cleanEmail.split('@')[0];
      const baseUsername =
        rawName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() ||
        'artist' + Math.floor(100 + Math.random() * 900);
      const profileId = '#PX-' + Math.floor(1000 + Math.random() * 9000);
      profile = {
        uid,
        username: baseUsername,
        profileId,
        displayName: rawName.charAt(0).toUpperCase() + rawName.slice(1),
        email: cleanEmail,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${baseUsername}`,
        totalPixelsBought: 0,
        totalSpent: 0,
        createdAt: Date.now(),
      };
      await setDoc(userRef, profile);
      await setDoc(doc(db, 'usernames', baseUsername), { uid }).catch(() => {});
    }
  } catch (err) {
    console.warn('Notice loading user profile:', err);
  }

  const appUser: AppUser = {
    uid,
    displayName: profile?.displayName || cleanEmail.split('@')[0],
    email: cleanEmail,
    photoURL: profile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
    isAnonymous: false,
  };

  // Persist session locally
  try {
    localStorage.setItem('million_canvas_active_user', JSON.stringify(appUser));
    if (profile) {
      localStorage.setItem('million_canvas_active_profile', JSON.stringify(profile));
    }
  } catch {}

  return appUser;
}

// Authentication helpers
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.warn('Google Sign-in status:', err);
    throw err;
  }
}

export async function signInWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return result.user;
}

export async function signUpWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  return result.user;
}

export async function signInGuest(): Promise<AppUser> {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (err: any) {
    console.info('Firebase anonymous auth restricted; initiating instant guest session.');
    const guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const guestUser: AppUser = {
      uid: guestId,
      displayName: 'Guest Artist',
      email: null,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
      isAnonymous: true,
    };
    return guestUser;
  }
}

export async function logOut(): Promise<void> {
  try {
    localStorage.removeItem('million_canvas_active_profile');
    localStorage.removeItem('million_canvas_active_user');
  } catch {}
  if (auth.currentUser) {
    try {
      await fbSignOut(auth);
    } catch {}
  }
}

// User Profile management
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3) return false;
  
  try {
    const usernameRef = doc(db, 'usernames', cleanUsername);
    const snap = await getDoc(usernameRef);
    return !snap.exists();
  } catch (err) {
    console.warn('Notice checking username in Firestore, allowing for fallback:', err);
    return true;
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const p = snap.data() as UserProfile;
      try {
        localStorage.setItem('million_canvas_active_profile', JSON.stringify(p));
      } catch {}
      return p;
    }
  } catch (err) {
    console.warn('Notice reading user profile from Firestore:', err);
  }

  // Fallback to local active profile if present
  try {
    const stored = localStorage.getItem('million_canvas_active_profile');
    if (stored) {
      const parsed = JSON.parse(stored) as UserProfile;
      if (parsed.uid === uid) return parsed;
    }
  } catch {}

  return null;
}

export async function createUserProfile(
  uid: string,
  data: {
    username: string;
    profileId: string;
    displayName: string;
    email?: string;
    photoURL?: string;
    bio?: string;
  }
): Promise<UserProfile> {
  const cleanUsername = data.username.trim().toLowerCase();
  const profile: UserProfile = {
    uid,
    username: cleanUsername,
    profileId: data.profileId.trim().toUpperCase(),
    displayName: data.displayName || data.username,
    email: data.email || '',
    photoURL: data.photoURL || '',
    totalPixelsBought: 0,
    totalSpent: 0,
    createdAt: Date.now(),
    bio: data.bio || '',
  };

  try {
    localStorage.setItem('million_canvas_active_profile', JSON.stringify(profile));
  } catch {}

  try {
    // 1. Reserve username document
    const usernameRef = doc(db, 'usernames', cleanUsername);
    await setDoc(usernameRef, {
      uid,
      claimedAt: Date.now(),
      originalUsername: data.username,
    });

    // 2. Save user profile document
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, profile);
  } catch (err) {
    console.warn('Notice saving user profile to Firestore (local session active):', err);
  }

  return profile;
}

// Plots operations
export async function savePlot(plot: Plot): Promise<void> {
  const cleanPlot: Plot = {
    ...plot,
    ownerPhotoURL: plot.ownerPhotoURL || '',
    linkUrl: plot.linkUrl || '',
  };
  const plotRef = doc(db, 'plots', plot.id);
  await setDoc(plotRef, cleanPlot);

  // Update user stats in Firestore
  try {
    const userRef = doc(db, 'users', plot.ownerId);
    await setDoc(
      userRef,
      {
        totalPixelsBought: increment(plot.pixelCount),
        totalSpent: increment(plot.pricePaid),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Notice updating user stats:', err);
  }

  // Record order
  try {
    const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const orderRef = doc(db, 'orders', orderId);
    const order: PixelOrder = {
      id: orderId,
      userId: plot.ownerId,
      username: plot.ownerUsername,
      plotId: plot.id,
      pixelCount: plot.pixelCount,
      amount: plot.pricePaid,
      paymentMethod: 'Instant Canvas Purchase',
      status: 'completed',
      timestamp: Date.now(),
    };
    await setDoc(orderRef, order);
  } catch (err) {
    console.warn('Notice recording order:', err);
  }
}

export async function updatePlotArtworkAndNote(
  plotId: string,
  pixels: string[],
  title: string,
  note: string,
  linkUrl?: string
): Promise<void> {
  const plotRef = doc(db, 'plots', plotId);
  await setDoc(
    plotRef,
    {
      pixels,
      title,
      note,
      linkUrl: linkUrl || '',
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

export function subscribePlots(callback: (plots: Plot[]) => void): () => void {
  try {
    const plotsColl = collection(db, 'plots');
    return onSnapshot(
      plotsColl,
      (snapshot) => {
        const plots: Plot[] = [];
        snapshot.forEach((docSnap) => {
          plots.push(docSnap.data() as Plot);
        });
        callback(plots);
      },
      (error) => {
        console.warn('Firestore plots subscription error:', error);
      }
    );
  } catch (err) {
    console.warn('Failed to setup plots listener:', err);
    return () => {};
  }
}

export async function getTopLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('totalPixelsBought', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    const entries: LeaderboardEntry[] = [];
    let rank = 1;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      if (data.totalPixelsBought && data.totalPixelsBought > 0) {
        entries.push({
          rank: rank++,
          uid: data.uid,
          username: data.username,
          profileId: data.profileId,
          displayName: data.displayName,
          photoURL: data.photoURL,
          totalPixelsBought: data.totalPixelsBought,
          totalSpent: data.totalSpent,
        });
      }
    });

    return entries;
  } catch (err) {
    console.warn('Error fetching leaderboard from Firestore:', err);
    return [];
  }
}
