import React from 'react';
import {
  Trophy,
  HelpCircle,
  LogIn,
  LogOut,
  User,
  DollarSign,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  rawUser: any;
  onLogin: () => void;
  onLogout: () => void;
  onOpenLeaderboard: () => void;
  onOpenSearch?: () => void;
  onOpenHowItWorks: () => void;
  onOpenMonetizationGuide: () => void;
  onOpenMyPlots: () => void;
  totalClaimedPixels: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  rawUser,
  onLogin,
  onLogout,
  onOpenLeaderboard,
  onOpenSearch,
  onOpenHowItWorks,
  onOpenMonetizationGuide,
  onOpenMyPlots,
  totalClaimedPixels,
}) => {
  const percentageClaimed = ((totalClaimedPixels / 1000000) * 100).toFixed(2);
  const totalValuation = (totalClaimedPixels * 0.50).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return (
    <header
      id="main-navbar"
      className="w-full bg-[#FAF8F5] border-b-[2.5px] border-black px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none sticky top-0 z-30"
    >
      {/* Brand & Concept */}
      <div className="flex items-center gap-3">
        <div className="bg-[#FFE169] border-[2.5px] border-black shadow-[3px_3px_0px_#000] px-3 py-1.5 rounded-xl flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#FF6B6B] border border-black rounded-xs animate-pulse" />
          <span className="font-extrabold text-xs sm:text-sm tracking-tight font-mono text-black uppercase">
            1M Pixels Canvas | 0.50$ each
          </span>
        </div>

        {/* Live Metrics Pill - Claimed amount / total (percentage) only */}
        <div className="hidden lg:flex items-center gap-2 bg-white border-[2px] border-black shadow-[2px_2px_0px_#000] px-3 py-1.5 rounded-xl text-xs font-semibold">
          <Layers className="w-3.5 h-3.5 text-[#5F27CD]" />
          <span className="text-gray-600">Claimed:</span>
          <span className="font-mono font-bold text-black">
            {totalClaimedPixels.toLocaleString()} / 1,000,000 ({percentageClaimed}%)
          </span>
        </div>
      </div>

      {/* Nav Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Top 50 Leaderboard */}
        <button
          id="btn-nav-leaderboard"
          onClick={onOpenLeaderboard}
          className="bg-[#FFE169] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2px_2px_0px_#000] px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-transform"
        >
          <Trophy className="w-3.5 h-3.5 text-black" />
          <span>Top 50</span>
        </button>

        {/* How It Works - Icon Only */}
        <button
          id="btn-nav-how-it-works"
          onClick={onOpenHowItWorks}
          title="How It Works"
          className="bg-white hover:bg-gray-50 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 sm:px-2 rounded-xl text-xs font-bold flex items-center justify-center transition-transform"
        >
          <HelpCircle className="w-4 h-4 text-blue-600" />
        </button>

        {/* International Monetization Guide for Owner - Symbol Only */}
        <button
          id="btn-nav-monetization"
          onClick={onOpenMonetizationGuide}
          className="bg-[#A388EE] hover:bg-purple-300 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2px_2px_0px_#000] p-1.5 sm:px-2 rounded-xl text-xs font-extrabold flex items-center justify-center transition-transform text-black"
          title="Earn Money Guide"
        >
          <DollarSign className="w-4 h-4 text-black" />
        </button>

        {/* User Account / Profile */}
        {user ? (
          <div className="flex items-center gap-2">
            <button
              id="btn-nav-my-plots"
              onClick={onOpenMyPlots}
              className="bg-[#4ECDC4] hover:bg-teal-300 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2px_2px_0px_#000] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-transform text-black"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">My Plots</span>
              <span className="bg-black text-white px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {user.totalPixelsBought || 0} px
              </span>
            </button>

            <div className="flex items-center gap-1.5 bg-white border-[2px] border-black shadow-[2px_2px_0px_#000] px-2.5 py-1 rounded-xl">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.username}
                  className="w-5 h-5 rounded-full border border-black object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#FFE169] border border-black flex items-center justify-center text-[10px] font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col text-left">
                <span className="text-xs font-extrabold font-mono text-black leading-none">
                  @{user.username}
                </span>
                <span className="text-[9px] font-mono text-gray-500 leading-none mt-0.5">
                  {user.profileId}
                </span>
              </div>
              <button
                id="btn-nav-logout"
                onClick={onLogout}
                title="Log Out"
                className="ml-1 text-gray-500 hover:text-red-600 p-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : rawUser ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-600 font-bold">Setting up profile...</span>
            <button
              onClick={onLogout}
              className="bg-gray-200 border-[2px] border-black shadow-[2px_2px_0px_#000] px-2 py-1 rounded-lg text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            id="btn-nav-login"
            onClick={onLogin}
            className="bg-[#FFE169] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 border-[2px] border-black shadow-[2.5px_2.5px_0px_#000] px-3.5 py-1.5 rounded-xl text-xs font-black text-black flex items-center gap-1.5 transition-transform cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </header>
  );
};
