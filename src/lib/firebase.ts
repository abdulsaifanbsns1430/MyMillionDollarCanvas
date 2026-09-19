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

// Authentication helpers
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.error('Google Sign-in error:', err);
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

export async function signInGuest(): Promise<FirebaseUser> {
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function logOut(): Promise<void> {
  await fbSignOut(auth);
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
    console.warn('Error checking username in Firestore, assuming true for fallback:', err);
    return true;
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.warn('Error getting user profile from Firestore:', err);
    return null;
  }
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
    console.error('Firestore save user profile error:', err);
  }

  return profile;
}

// Plots operations
export async function savePlot(plot: Plot): Promise<void> {
  try {
    const cleanPlot: Plot = {
      ...plot,
      ownerPhotoURL: plot.ownerPhotoURL || '',
      linkUrl: plot.linkUrl || '',
    };
    const plotRef = doc(db, 'plots', plot.id);
    await setDoc(plotRef, cleanPlot);

    // Update user stats
    const userRef = doc(db, 'users', plot.ownerId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const current = userSnap.data() as UserProfile;
      await updateDoc(userRef, {
        totalPixelsBought: (current.totalPixelsBought || 0) + plot.pixelCount,
        totalSpent: (current.totalSpent || 0) + plot.pricePaid,
      });
    }

    // Record order
    const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const orderRef = doc(db, 'orders', orderId);
    const order: PixelOrder = {
      id: orderId,
      userId: plot.ownerId,
      username: plot.ownerUsername,
      plotId: plot.id,
      pixelCount: plot.pixelCount,
      amount: plot.pricePaid,
      paymentMethod: 'Demo Payment (Instant Simulated Checkout)',
      status: 'completed',
      timestamp: Date.now(),
    };
    await setDoc(orderRef, order);
  } catch (err) {
    console.error('Error saving plot to Firestore:', err);
    throw err;
  }
}

export async function updatePlotArtworkAndNote(
  plotId: string,
  pixels: string[],
  title: string,
  note: string,
  linkUrl?: string
): Promise<void> {
  try {
    const plotRef = doc(db, 'plots', plotId);
    await updateDoc(plotRef, {
      pixels,
      title,
      note,
      linkUrl: linkUrl || '',
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('Error updating plot artwork:', err);
    throw err;
  }
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
