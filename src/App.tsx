import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { CanvasEngine } from './components/CanvasEngine';
import { Toolbar } from './components/Toolbar';
import { MiniMap } from './components/MiniMap';
import { AuthModal } from './components/AuthModal';
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
  logOut,
  getUserProfile,
  subscribePlots,
  savePlot,
  updatePlotArtworkAndNote,
  AppUser,
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './lib/canvasUtils';

export default function App() {
  // Auth state
  const [rawUser, setRawUser] = useState<FirebaseUser | AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Canvas & Plot state
  // Default mode is 'pan' as requested!
  const [mode, setMode] = useState<'pan' | 'select'>('pan');
  const [selectionAction, setSelectionAction] = useState<'add' | 'remove'>('add');
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selection, setSelection] = useState<PixelSelection | null>(null);
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);

  // Viewport tracking (default centered on 500, 500 for 1000x1000)
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

  // Center canvas on first load (1000x1000)
  useEffect(() => {
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight - 60;
    const initialZoom = 1.0;

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

  // Listen to Auth state (Firebase Auth & Email OTP sessions)
  useEffect(() => {
    // Initial check for active Email OTP session
    try {
      const storedUser = localStorage.getItem('million_canvas_active_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setRawUser(parsed);
        getUserProfile(parsed.uid).then((p) => {
          if (p) setUserProfile(p);
        });
      }
    } catch {}

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setRawUser(fbUser);
        try {
          const profile = await getUserProfile(fbUser.uid);
          if (profile) {
            setUserProfile(profile);
            setShowOnboarding(false);
          } else {
            // User successfully authenticated for the first time -> prompt onboarding modal
            setShowOnboarding(true);
          }
        } catch (err) {
          console.warn('Profile fetch error, prompting onboarding:', err);
          setShowOnboarding(true);
        }
      } else {
        // Check for Email OTP session
        try {
          const storedUser = localStorage.getItem('million_canvas_active_user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setRawUser(parsed);
            const profile = await getUserProfile(parsed.uid);
            if (profile) {
              setUserProfile(profile);
              setShowOnboarding(false);
              return;
            }
          }
        } catch {}
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
      setPlots(remotePlots || []);
    });

    return () => unsubscribe();
  }, []);

  // Handle Login button clicked
  const handleOpenLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setRawUser(null);
      setUserProfile(null);
      setShowOnboarding(false);
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
      setIsAuthModalOpen(true);
      return;
    }

    if (selection && selection.pixelCount > 0) {
      setIsBuyModalOpen(true);
    }
  };

  // Purchase Complete Callback (supports multiple plots/areas)
  const handlePurchaseSuccess = async (newPlots: Plot[]) => {
    try {
      // 1. Save all plots to Firestore
      for (const plot of newPlots) {
        await savePlot(plot);
      }

      // 2. Update local state
      setPlots((prev) => [...prev, ...newPlots]);
      const addedPixels = newPlots.reduce((sum, p) => sum + p.pixelCount, 0);
      const addedCost = newPlots.reduce((sum, p) => sum + p.pricePaid, 0);

      if (userProfile) {
        setUserProfile({
          ...userProfile,
          totalPixelsBought: (userProfile.totalPixelsBought || 0) + addedPixels,
          totalSpent: (userProfile.totalSpent || 0) + addedCost,
        });
      }

      // 3. Close buy modal & clear selection
      setIsBuyModalOpen(false);
      setSelection(null);

      // 4. Open Paint Studio for the first plot
      if (newPlots.length > 0) {
        setActivePlotForPaint(newPlots[0]);
      }
    } catch (err) {
      console.error('Error saving new plot to Firebase:', err);
      // Ensure local state preserves plot even on network delay
      setPlots((prev) => [...prev, ...newPlots]);
      setIsBuyModalOpen(false);
      setSelection(null);
      if (newPlots.length > 0) {
        setActivePlotForPaint(newPlots[0]);
      }
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
    <div
      id="million-dollar-canvas-app"
      className="w-screen h-screen flex flex-col bg-[#FAF8F5] overflow-hidden select-none"
    >
      {/* Top Neo-Brutalist Navbar */}
      <Navbar
        user={userProfile}
        rawUser={rawUser}
        onLogin={handleOpenLogin}
        onLogout={handleLogout}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenMonetizationGuide={() => setIsMonetizationOpen(true)}
        onOpenMyPlots={() => setIsMyPlotsOpen(true)}
        totalClaimedPixels={totalClaimedPixels}
      />

      {/* Main Canvas Viewport Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden bg-[#ECE7DE]">
        {/* Floating Top Toolbar */}
        <Toolbar
          mode={mode}
          onModeChange={setMode}
          selectionAction={selectionAction}
          onSelectionActionChange={setSelectionAction}
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
          selectionAction={selectionAction}
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

      {/* 0. Real Firebase Authentication Modal */}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={async (user) => {
            setRawUser(user);
            setIsAuthModalOpen(false);
            try {
              const profile = await getUserProfile(user.uid);
              if (profile) {
                setUserProfile(profile);
                setShowOnboarding(false);
              } else {
                setShowOnboarding(true);
              }
            } catch {
              setShowOnboarding(true);
            }
          }}
        />
      )}

      {/* 1. Onboarding Profile Gate (Appears ONLY AFTER Successful Firebase Login) */}
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
