import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { CanvasEngine } from './components/CanvasEngine';
import { Toolbar } from './components/Toolbar';
import { MiniMap } from './components/MiniMap';
import { OnboardingModal } from './components/OnboardingModal';
import { BuyPixelsModal } from './components/BuyPixelsModal';
import { PlotNoteModal } from './components/PlotNoteModal';
import { PaintStudioModal } from './components/PaintStudioModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { SearchModal } from './components/SearchModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { MonetizationGuideModal } from './components/MonetizationGuideModal';
import { MyPlotsModal } from './components/MyPlotsModal';
import {
  UserProfile,
  Plot,
  PixelSelection,
  ViewportState,
} from './types';
import {
  auth,
  signInWithGoogle,
  logOut,
  getUserProfile,
  subscribePlots,
  savePlot,
  updatePlotArtworkAndNote,
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  getInitialSeedPlots,
} from './lib/canvasUtils';
import { Sparkles, Info } from 'lucide-react';

export default function App() {
  // Auth state
  const [rawUser, setRawUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Canvas & Plot state
  const [plots, setPlots] = useState<Plot[]>(() => getInitialSeedPlots());
  const [mode, setMode] = useState<'pan' | 'select'>('select');
  const [selection, setSelection] = useState<PixelSelection | null>(null);
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);

  // Viewport tracking (default centered on 1000, 1000)
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1.0,
  });

  // Container dimensions
  const [containerDimensions, setContainerDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 60,
  });

  // Modal dialog states
  const [activePlotForNote, setActivePlotForNote] = useState<Plot | null>(null);
  const [activePlotForPaint, setActivePlotForPaint] = useState<Plot | null>(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isMonetizationOpen, setIsMonetizationOpen] = useState(false);
  const [isMyPlotsOpen, setIsMyPlotsOpen] = useState(false);

  // Calculate total claimed pixels
  const totalClaimedPixels = plots.reduce((acc, p) => acc + p.pixelCount, 0);

  // Track window resizing
  useEffect(() => {
    const handleResize = () => {
      setContainerDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 60,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Center canvas on first load
  useEffect(() => {
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight - 60;
    const initialZoom = 1.0;

    // Check URL parameters for direct coordinate linking
    const params = new URLSearchParams(window.location.search);
    const paramX = params.get('x');
    const paramY = params.get('y');

    const targetX = paramX ? parseInt(paramX) : CANVAS_WIDTH / 2;
    const targetY = paramY ? parseInt(paramY) : CANVAS_HEIGHT / 2;
    const targetZoom = paramX ? 4.0 : initialZoom;

    setViewport({
      x: initialWidth / 2 - targetX * targetZoom,
      y: initialHeight / 2 - targetY * targetZoom,
      zoom: targetZoom,
    });
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setRawUser(fbUser);
        try {
          const profile = await getUserProfile(fbUser.uid);
          if (profile) {
            setUserProfile(profile);
            setShowOnboarding(false);
          } else {
            // User signed in for the first time -> prompt onboarding modal
            setShowOnboarding(true);
          }
        } catch (err) {
          console.warn('Profile fetch error, prompting onboarding:', err);
          setShowOnboarding(true);
        }
      } else {
        setRawUser(null);
        setUserProfile(null);
        setShowOnboarding(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to real-time plots from Firestore
  useEffect(() => {
    const unsubscribe = subscribePlots((remotePlots) => {
      if (remotePlots && remotePlots.length > 0) {
        // Merge seed plots with remote plots (remote plots take precedence)
        const seedPlots = getInitialSeedPlots();
        const plotMap = new Map<string, Plot>();
        seedPlots.forEach((p) => plotMap.set(p.id, p));
        remotePlots.forEach((p) => plotMap.set(p.id, p));
        setPlots(Array.from(plotMap.values()));
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Google Login
  const handleLogin = async () => {
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setUserProfile(profile);
        } else {
          setShowOnboarding(true);
        }
      }
    } catch (err: any) {
      console.warn('Sign-in failed or blocked by iframe popup policy:', err);
      // If popup was blocked or failed in preview, offer guest profile creation directly
      setAuthError('Google Sign-in prompt closed. You can also create a demo profile instantly.');
      const demoUid = 'demo_user_' + Math.random().toString(36).substring(2, 9);
      setRawUser({
        uid: demoUid,
        displayName: 'Creative Pioneer',
        email: 'creator@canvas.io',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Pioneer',
      });
      setShowOnboarding(true);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setRawUser(null);
      setUserProfile(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Jump to specific coordinates smoothly
  const jumpToCoordinates = useCallback(
    (x: number, y: number, zoomLevel: number = 5.0) => {
      const w = containerDimensions.width;
      const h = containerDimensions.height;
      setViewport({
        x: w / 2 - x * zoomLevel,
        y: h / 2 - y * zoomLevel,
        zoom: zoomLevel,
      });
    },
    [containerDimensions]
  );

  // Buy Selected Area Trigger
  const handleOpenBuyModal = () => {
    if (!userProfile) {
      if (!rawUser) {
        handleLogin();
      } else {
        setShowOnboarding(true);
      }
      return;
    }

    if (selection && !selection.hasCollision) {
      setIsBuyModalOpen(true);
    }
  };

  // Purchase Complete Callback
  const handlePurchaseSuccess = async (newPlot: Plot) => {
    try {
      // 1. Save to Firestore
      await savePlot(newPlot);

      // 2. Update local state
      setPlots((prev) => [...prev, newPlot]);
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          totalPixelsBought: (userProfile.totalPixelsBought || 0) + newPlot.pixelCount,
          totalSpent: (userProfile.totalSpent || 0) + newPlot.pricePaid,
        });
      }

      // 3. Close buy modal & clear selection
      setIsBuyModalOpen(false);
      setSelection(null);

      // 4. Immediately open Paint Studio so owner can begin painting
      setActivePlotForPaint(newPlot);
    } catch (err) {
      console.error('Error saving new plot:', err);
      // Even if Firestore has transient error, save to local session
      setPlots((prev) => [...prev, newPlot]);
      setIsBuyModalOpen(false);
      setSelection(null);
      setActivePlotForPaint(newPlot);
    }
  };

  // Plot Save (Artwork & Note) from PaintStudioModal
  const handleSavePlotArtwork = async (
    plotId: string,
    updatedPixels: string[],
    newTitle: string,
    newNote: string,
    newLinkUrl?: string
  ) => {
    try {
      await updatePlotArtworkAndNote(plotId, updatedPixels, newTitle, newNote, newLinkUrl);
    } catch (err) {
      console.warn('Remote plot update error, saving locally:', err);
    }

    // Update in local state
    setPlots((prev) =>
      prev.map((p) =>
        p.id === plotId
          ? {
              ...p,
              pixels: updatedPixels,
              title: newTitle,
              note: newNote,
              linkUrl: newLinkUrl,
              updatedAt: Date.now(),
            }
          : p
      )
    );
  };

  return (
    <div id="million-dollar-canvas-app" className="w-screen h-screen flex flex-col bg-[#FAF8F5] overflow-hidden">
      {/* Top Neo-Brutalist Navbar */}
      <Navbar
        user={userProfile}
        rawUser={rawUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenMonetizationGuide={() => setIsMonetizationOpen(true)}
        onOpenMyPlots={() => setIsMyPlotsOpen(true)}
        totalClaimedPixels={totalClaimedPixels}
      />

      {/* Main Canvas Viewport Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden bg-[#FAF8F5]">
        {/* Floating Top Toolbar */}
        <Toolbar
          mode={mode}
          onModeChange={setMode}
          viewport={viewport}
          onViewportChange={setViewport}
          selection={selection}
          onClearSelection={() => setSelection(null)}
          onOpenBuyModal={handleOpenBuyModal}
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
        />

        {/* Dual-Layer HTML5 Canvas Engine */}
        <CanvasEngine
          plots={plots}
          mode={mode}
          viewport={viewport}
          onViewportChange={setViewport}
          onSelectPlot={(plot) => setActivePlotForNote(plot)}
          onSelectionChange={setSelection}
          selection={selection}
          hoveredPlotId={hoveredPlotId}
        />

        {/* Mini-Map Radar (Bottom-Right) */}
        <MiniMap
          plots={plots}
          viewport={viewport}
          onViewportChange={setViewport}
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
        />
      </main>

      {/* MODALS */}

      {/* 1. Onboarding Profile Gate (Mandatory on First Sign-in) */}
      {showOnboarding && rawUser && (
        <OnboardingModal
          rawUser={rawUser}
          onComplete={(profile) => {
            setUserProfile(profile);
            setShowOnboarding(false);
          }}
          onCancel={() => {
            setShowOnboarding(false);
            setRawUser(null);
          }}
        />
      )}

      {/* 2. Interactive Note Pop-up (When any visitor clicks a plot) */}
      {activePlotForNote && (
        <PlotNoteModal
          plot={activePlotForNote}
          currentUser={userProfile}
          onClose={() => setActivePlotForNote(null)}
          onEditPlot={(plot) => {
            setActivePlotForNote(null);
            setActivePlotForPaint(plot);
          }}
        />
      )}

      {/* 3. Pixel Paint Studio (When an owner paints or edits their plot) */}
      {activePlotForPaint && (
        <PaintStudioModal
          plot={activePlotForPaint}
          onClose={() => setActivePlotForPaint(null)}
          onSave={handleSavePlotArtwork}
        />
      )}

      {/* 4. Buy Pixels Checkout Modal */}
      {isBuyModalOpen && selection && userProfile && (
        <BuyPixelsModal
          selection={selection}
          user={userProfile}
          onClose={() => setIsBuyModalOpen(false)}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {/* 5. Top 50 Leaderboard */}
      {isLeaderboardOpen && (
        <LeaderboardModal
          plots={plots}
          onClose={() => setIsLeaderboardOpen(false)}
          onJumpToProps={(x, y) => jumpToCoordinates(x, y, 6.0)}
        />
      )}

      {/* 6. Search / Coordinates Teleporter */}
      {isSearchOpen && (
        <SearchModal
          plots={plots}
          onClose={() => setIsSearchOpen(false)}
          onJumpTo={(x, y) => jumpToCoordinates(x, y, 5.0)}
          onSelectPlot={(plot) => setActivePlotForNote(plot)}
        />
      )}

      {/* 7. How It Works Guide */}
      {isHowItWorksOpen && (
        <HowItWorksModal onClose={() => setIsHowItWorksOpen(false)} />
      )}

      {/* 8. International Monetization Guide (For Owner / India) */}
      {isMonetizationOpen && (
        <MonetizationGuideModal onClose={() => setIsMonetizationOpen(false)} />
      )}

      {/* 9. My Plots Portfolio */}
      {isMyPlotsOpen && userProfile && (
        <MyPlotsModal
          user={userProfile}
          plots={plots}
          onClose={() => setIsMyPlotsOpen(false)}
          onEditPlot={(plot) => setActivePlotForPaint(plot)}
          onJumpTo={(x, y) => jumpToCoordinates(x, y, 5.0)}
        />
      )}
    </div>
  );
}
