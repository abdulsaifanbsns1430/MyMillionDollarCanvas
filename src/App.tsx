import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { CanvasEngine } from './components/CanvasEngine';
import { BottomStudioBar } from './components/BottomStudioBar';
import { MiniMap } from './components/MiniMap';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { PlotCheckoutModal } from './components/PlotCheckoutModal';
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
  WorkflowStep,
  SelectTool,
  PaintTool,
} from './types';
import {
  auth,
  logOut,
  getUserProfile,
  subscribePlots,
  savePlot,
  updatePlotArtworkAndNote,
  getGoogleAccountStatus,
  AppUser,
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  applyDragSelection,
  mapImageToDraftPixels,
  getSelectionPixelSet,
} from './lib/canvasUtils';

export default function App() {
  // Auth state
  const [rawUser, setRawUser] = useState<FirebaseUser | AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Workflow State Machine
  const [step, setStep] = useState<WorkflowStep>('idle');
  const [inspectCoord, setInspectCoord] = useState<{ x: number; y: number } | null>(null);
  const [selectTool, setSelectTool] = useState<SelectTool>('add');
  const [paintTool, setPaintTool] = useState<PaintTool>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#FF6B6B');
  const [draftPixels, setDraftPixels] = useState<Map<string, string>>(new Map());

  // Canvas & Plot state
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selection, setSelection] = useState<PixelSelection | null>(null);
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);

  // Viewport tracking (default centered on 500, 500)
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
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isMonetizationOpen, setIsMonetizationOpen] = useState(false);
  const [isMyPlotsOpen, setIsMyPlotsOpen] = useState(false);

  // Calculate total claimed pixels
  const totalClaimedPixels = plots.reduce((acc, p) => acc + p.pixelCount, 0);

  // Window resize handler
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

  // Auth State Listener
  useEffect(() => {
    // Immediate hydration from localStorage if available
    try {
      const storedUser = localStorage.getItem('million_canvas_active_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setRawUser(parsed);
        getUserProfile(parsed.uid, parsed.email || undefined).then((p) => {
          if (p && p.username) {
            setUserProfile(p);
            setShowOnboarding(false);
          }
        });
      }
    } catch {}

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setRawUser(fbUser);
        try {
          const profile = await getUserProfile(fbUser.uid, fbUser.email || undefined);
          if (profile && profile.username) {
            setUserProfile(profile);
            setShowOnboarding(false);
          } else {
            setShowOnboarding(true);
          }
        } catch (err) {
          console.warn('Profile fetch error:', err);
        }
      } else {
        try {
          const storedUser = localStorage.getItem('million_canvas_active_user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setRawUser(parsed);
            const profile = await getUserProfile(parsed.uid, parsed.email || undefined);
            if (profile && profile.username) {
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

  // Real-time Firestore Plots Subscription
  useEffect(() => {
    const unsubscribe = subscribePlots((remotePlots) => {
      setPlots(remotePlots || []);
    });
    return () => unsubscribe();
  }, []);

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

  // Workflow Handlers
  const handleInspectPixel = (x: number, y: number) => {
    setInspectCoord({ x, y });
    const initSel = applyDragSelection(x, y, x, y, plots, [], 'add');
    setSelection(initSel);
    setStep('inspect');
  };

  const handleStartSelecting = () => {
    if (inspectCoord) {
      // Initialize selection with clicked pixel
      const initSel = applyDragSelection(
        inspectCoord.x,
        inspectCoord.y,
        inspectCoord.x,
        inspectCoord.y,
        plots,
        [],
        'add'
      );
      setSelection(initSel);
    }
    setStep('select');
    setSelectTool('add');
  };

  const handleClearSelection = () => {
    setSelection(null);
    setDraftPixels(new Map());
  };

  const handleCancelWorkflow = () => {
    setStep('idle');
    setInspectCoord(null);
    setSelection(null);
    setDraftPixels(new Map());
    setIsCheckoutModalOpen(false);
  };

  const handleProceedToPaint = () => {
    if (!selection || selection.pixelCount === 0) return;

    // Seed default draft color for selected pixels if draft is empty
    const pixelSet = getSelectionPixelSet(selection);
    setDraftPixels((prev) => {
      const next = new Map(prev);
      pixelSet.forEach((key) => {
        if (!next.has(key)) {
          next.set(key, '#FFE169');
        }
      });
      return next;
    });

    setStep('paint');
    setPaintTool('brush');
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectTool('add');
  };

  const handleProceedToCheckout = () => {
    if (!userProfile) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!selection || selection.pixelCount === 0) return;
    setIsCheckoutModalOpen(true);
  };

  // Painting handlers
  const handlePaintPixel = (x: number, y: number, color: string) => {
    const key = `${x},${y}`;
    setDraftPixels((prev) => {
      const next = new Map(prev);
      next.set(key, color);
      return next;
    });
  };

  const handleFillSelection = (color: string) => {
    if (!selection) return;
    const pixelSet = getSelectionPixelSet(selection);
    setDraftPixels((prev) => {
      const next = new Map(prev);
      pixelSet.forEach((key) => {
        next.set(key, color);
      });
      return next;
    });
  };

  // Upload image and span across entire selection
  const handleUploadImage = async (file: File) => {
    if (!selection || selection.pixelCount === 0) return;
    try {
      const mapped = await mapImageToDraftPixels(file, selection);
      setDraftPixels(mapped);
    } catch (err) {
      console.error('Image mapping error:', err);
    }
  };

  // Purchase Complete Callback
  const handlePurchaseSuccess = async (newPlotsInput: Plot | Plot[]) => {
    const plotList = Array.isArray(newPlotsInput) ? newPlotsInput : [newPlotsInput];
    try {
      // 1. Save all plots to Firestore
      for (const plot of plotList) {
        await savePlot(plot);
      }

      // 2. Update local plots
      setPlots((prev) => [...prev, ...plotList]);

      if (userProfile) {
        const addedPixels = plotList.reduce((acc, p) => acc + p.pixelCount, 0);
        const addedSpent = plotList.reduce((acc, p) => acc + p.pricePaid, 0);
        setUserProfile({
          ...userProfile,
          totalPixelsBought: (userProfile.totalPixelsBought || 0) + addedPixels,
          totalSpent: (userProfile.totalSpent || 0) + addedSpent,
        });
      }

      // 3. Reset workflow
      setIsCheckoutModalOpen(false);
      setSelection(null);
      setDraftPixels(new Map());
      setInspectCoord(null);
      setStep('idle');
    } catch (err) {
      console.error('Error saving new plots to Firebase:', err);
      setPlots((prev) => [...prev, ...plotList]);
      setIsCheckoutModalOpen(false);
      setSelection(null);
      setDraftPixels(new Map());
      setInspectCoord(null);
      setStep('idle');
    }
  };

  // Plot Save (Artwork & Note) from PaintStudioModal for existing owned plots
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
        {/* Canvas Engine */}
        <CanvasEngine
          plots={plots}
          step={step}
          selectTool={selectTool}
          paintTool={paintTool}
          currentColor={currentColor}
          onColorChange={setCurrentColor}
          viewport={viewport}
          onViewportChange={setViewport}
          onSelectPlot={(plot) => setActivePlotForNote(plot)}
          onInspectPixel={handleInspectPixel}
          onSelectionChange={setSelection}
          selection={selection}
          draftPixels={draftPixels}
          onPaintPixel={handlePaintPixel}
          onFillSelection={handleFillSelection}
          hoveredPlotId={hoveredPlotId}
          onHoverPlot={setHoveredPlotId}
        />

        {/* Animated Bottom Studio Bar (Inspect, Selection, and Paint workflows) */}
        <BottomStudioBar
          step={step}
          inspectCoord={inspectCoord}
          selectTool={selectTool}
          onSelectToolChange={setSelectTool}
          paintTool={paintTool}
          onPaintToolChange={setPaintTool}
          currentColor={currentColor}
          onColorChange={setCurrentColor}
          selection={selection}
          onStartSelecting={handleStartSelecting}
          onClearSelection={handleClearSelection}
          onCancelWorkflow={handleCancelWorkflow}
          onProceedToPaint={handleProceedToPaint}
          onBackToSelect={handleBackToSelect}
          onProceedToCheckout={handleProceedToCheckout}
          onUploadImage={handleUploadImage}
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
              if (profile && profile.username) {
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

      {/* 1. Onboarding Profile Gate */}
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

      {/* 2. Interactive Note Pop-up (When clicking an owned plot) */}
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

      {/* 3. Pixel Paint Studio (When an owner re-edits an existing owned plot) */}
      {activePlotForPaint && (
        <PaintStudioModal
          plot={activePlotForPaint}
          onClose={() => setActivePlotForPaint(null)}
          onSave={handleSavePlotArtwork}
        />
      )}

      {/* 4. Brand New Checkout & Claim Modal (Step 3) */}
      {isCheckoutModalOpen && selection && userProfile && (
        <PlotCheckoutModal
          selection={selection}
          draftPixels={draftPixels}
          user={userProfile}
          onClose={() => setIsCheckoutModalOpen(false)}
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

      {/* 8. International Monetization Guide */}
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
