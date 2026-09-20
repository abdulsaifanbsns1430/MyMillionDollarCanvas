export interface UserProfile {
  uid: string;
  username: string; // unique, e.g. 'pixel_king'
  profileId: string; // unique, e.g. '#PX-7721'
  displayName: string;
  email?: string;
  photoURL?: string;
  totalPixelsBought: number;
  totalSpent: number;
  createdAt: number;
  bio?: string;
}

export interface Plot {
  id: string; // e.g. 'plot_x200_y300_w20_h20'
  ownerId: string;
  ownerUsername: string;
  ownerProfileId: string;
  ownerPhotoURL?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
  pricePaid: number;
  title: string;
  note: string;
  linkUrl?: string;
  // Encoded pixel data for this plot. Can be a 2D hex array or flat array of '#RRGGBB'
  // Stored as a compact JSON string or flat array
  pixels: string[]; // length = width * height
  createdAt: number;
  updatedAt: number;
}

export interface SelectionRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
  cost: number;
}

export interface PixelSelection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  height: number;
  x: number;
  y: number;
  // Multi-region support
  regions: SelectionRegion[];
  connectedAreaCount?: number;
  pixelCount: number;
  cost: number;
  hasCollision?: boolean;
  collidingPlots?: string[];
  // Automatic exclusion metadata
  excludedOwnedPixelsCount: number;
  excludedPlotTitles?: string[];
  notificationMessage?: string;
}

export interface ViewportState {
  x: number; // world x offset in screen pixels
  y: number; // world y offset in screen pixels
  zoom: number; // 0.25 to 32
}

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  username: string;
  profileId: string;
  displayName: string;
  photoURL?: string;
  totalPixelsBought: number;
  totalSpent: number;
  largestPlotId?: string;
  largestPlotCoords?: { x: number; y: number };
}

export interface PixelOrder {
  id: string;
  userId: string;
  username: string;
  plotId: string;
  pixelCount: number;
  amount: number;
  paymentMethod: string;
  status: 'completed' | 'pending';
  timestamp: number;
}
