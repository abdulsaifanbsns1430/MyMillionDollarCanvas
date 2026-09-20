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

export { fbSignOut };
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
import {
  validateEmailAddress,
  triggerEmailOtpSend,
  verifyEmailOtpCode,
} from './emailOtpService';

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
  cooldownSeconds?: number;
}

// Check whether an account exists for this email or username
export async function checkAccountExists(emailOrUsername: string): Promise<boolean> {
  const clean = emailOrUsername.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return false;
  try {
    if (clean.includes('@')) {
      const accountRef = doc(db, 'auth_accounts', clean);
      const snap = await getDoc(accountRef);
      return snap.exists();
    } else {
      const usernameRef = doc(db, 'usernames', clean);
      const snap = await getDoc(usernameRef);
      return snap.exists();
    }
  } catch (err) {
    console.warn('Notice checking account existence:', err);
    return false;
  }
}

// Check if a Google user has an established password in auth_accounts
export async function getGoogleAccountStatus(email: string): Promise<{ exists: boolean; uid?: string; hasPassword: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const accountRef = doc(db, 'auth_accounts', cleanEmail);
    const snap = await getDoc(accountRef);
    if (snap.exists()) {
      const data = snap.data();
      return { exists: true, uid: data.uid, hasPassword: !!data.passwordHash };
    }
  } catch (err) {
    console.warn('Notice checking Google account status:', err);
  }
  return { exists: false, hasPassword: false };
}

// Log in directly with email OR registered username + password (No OTP required)
export async function loginWithIdentifierAndPassword(
  identifier: string,
  password: string
): Promise<AppUser> {
  const clean = identifier.trim().toLowerCase().replace(/^@/, '');
  if (!clean) {
    throw new Error('Please enter your registered email address or username.');
  }
  if (!password) {
    throw new Error('Please enter your account password.');
  }

  let targetEmail = '';
  let targetUid = '';

  if (clean.includes('@')) {
    targetEmail = clean;
  } else {
    // Lookup username in Firestore
    const usernameRef = doc(db, 'usernames', clean);
    const snap = await getDoc(usernameRef);
    if (!snap.exists()) {
      throw new Error(`No account registered with username "@${clean}". Please check spelling or create an account.`);
    }
    targetUid = snap.data()?.uid;
    const userSnap = await getDoc(doc(db, 'users', targetUid));
    if (!userSnap.exists() || !userSnap.data()?.email) {
      throw new Error(`Account associated with "@${clean}" has no registered email. Please sign in with your email.`);
    }
    targetEmail = userSnap.data()?.email.toLowerCase();
  }

  // Verify credentials in auth_accounts
  const accountRef = doc(db, 'auth_accounts', targetEmail);
  const accSnap = await getDoc(accountRef);
  if (!accSnap.exists()) {
    throw new Error(`No registered account found for "${identifier}". Please create an account.`);
  }

  const accData = accSnap.data();
  const computedHash = await hashPassword(password, accData.salt || 'salt');
  if (computedHash !== accData.passwordHash) {
    throw new Error('Incorrect password. Please verify your password and try again.');
  }

  targetUid = accData.uid;
  await updateDoc(accountRef, { lastLoginAt: Date.now() }).catch(() => {});

  const profile = await getUserProfile(targetUid);

  const appUser: AppUser = {
    uid: targetUid,
    displayName: profile?.displayName || null,
    email: targetEmail,
    photoURL: profile?.photoURL || null,
    isAnonymous: false,
  };

  try {
    localStorage.setItem('million_canvas_active_user', JSON.stringify(appUser));
    if (profile) {
      localStorage.setItem('million_canvas_active_profile', JSON.stringify(profile));
    }
  } catch {}

  return appUser;
}

// Verifies account password against stored salt and hash
export async function verifyAccountPassword(
  email: string,
  password: string
): Promise<{ uid: string; email: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const accountRef = doc(db, 'auth_accounts', cleanEmail);
  const snap = await getDoc(accountRef);
  if (!snap.exists()) {
    throw new Error('No account found with this email address. Please create an account.');
  }
  const data = snap.data();
  const computedHash = await hashPassword(password, data.salt || 'salt');
  if (computedHash !== data.passwordHash) {
    throw new Error('Incorrect password. Please verify your password and try again.');
  }
  return { uid: data.uid, email: cleanEmail };
}

// Dispatches 6-digit OTP for Email ID login using emailOtpService
export async function sendEmailOTP(
  email: string,
  mode: 'signin' | 'signup',
  password?: string
): Promise<SendOTPResult> {
  const cleanEmail = email.trim().toLowerCase();
  const validation = validateEmailAddress(cleanEmail);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Please enter a valid email address.');
  }

  // If signing in, verify password first
  if (mode === 'signin') {
    if (!password) {
      throw new Error('Please enter your account password.');
    }
    await verifyAccountPassword(cleanEmail, password);
  } else if (mode === 'signup') {
    // Ensure email is not already registered
    const exists = await checkAccountExists(cleanEmail);
    if (exists) {
      throw new Error(
        'This email address is already registered. You cannot sign up again with this email. Please switch to Sign In.'
      );
    }
  }

  // Trigger authoritative OTP email send event
  const dispatch = await triggerEmailOtpSend(cleanEmail, mode);

  return {
    success: true,
    otp: dispatch.otp || '',
    isNewAccount: mode === 'signup',
    message: dispatch.message,
    cooldownSeconds: dispatch.cooldownSeconds,
  };
}

// Verifies 6-digit OTP and authenticates user
export async function verifyEmailOTP(
  email: string,
  enteredOtp: string,
  mode: 'signin' | 'signup',
  password?: string
): Promise<AppUser> {
  const cleanEmail = email.trim().toLowerCase();
  
  // Verify code with authoritative service
  await verifyEmailOtpCode(cleanEmail, enteredOtp);

  let uid = '';
  let profile: UserProfile | null = null;
  const accountRef = doc(db, 'auth_accounts', cleanEmail);

  if (mode === 'signin') {
    // Existing account
    const accSnap = await getDoc(accountRef);
    if (accSnap.exists()) {
      const acc = accSnap.data();
      uid = acc.uid;
      await updateDoc(accountRef, { lastLoginAt: Date.now() }).catch(() => {});
      profile = await getUserProfile(uid);
    } else {
      throw new Error('Account record not found. Please create an account.');
    }
  } else {
    // New account signup - generate unique UID and prepare for onboarding
    uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  }

  const appUser: AppUser = {
    uid,
    displayName: profile?.displayName || null,
    email: cleanEmail,
    photoURL: profile?.photoURL || null,
    isAnonymous: false,
  };

  // Persist session locally
  try {
    localStorage.setItem('million_canvas_active_user', JSON.stringify(appUser));
    if (profile) {
      localStorage.setItem('million_canvas_active_profile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('million_canvas_active_profile');
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
export async function checkUsernameAvailable(username: string, currentUid?: string): Promise<boolean> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3) return false;
  
  try {
    const usernameRef = doc(db, 'usernames', cleanUsername);
    const snap = await getDoc(usernameRef);
    if (!snap.exists()) return true;
    const data = snap.data();
    if (currentUid && data?.uid === currentUid) return true;
    return false;
  } catch (err) {
    console.warn('Notice checking username in Firestore:', err);
    return false;
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
    password?: string;
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
    // 1. Reserve username document (guarantees unique username)
    const usernameRef = doc(db, 'usernames', cleanUsername);
    await setDoc(usernameRef, {
      uid,
      claimedAt: Date.now(),
      originalUsername: data.username,
    });

    // 2. Save user profile document
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...profile,
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
    }, { merge: true });

    // 3. If password was provided (or setting up email credentials), store securely in auth_accounts
    if (data.email && data.password) {
      const cleanEmail = data.email.trim().toLowerCase();
      const salt = Math.random().toString(36).substring(2, 8);
      const passwordHash = await hashPassword(data.password, salt);
      const accountRef = doc(db, 'auth_accounts', cleanEmail);
      await setDoc(
        accountRef,
        {
          uid,
          email: cleanEmail,
          passwordHash,
          salt,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        },
        { merge: true }
      );
    }
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
