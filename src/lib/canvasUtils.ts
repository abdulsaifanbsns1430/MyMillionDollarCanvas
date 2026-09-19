import { Plot, PixelSelection, SelectionRegion } from '../types';

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 1000;
export const TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT; // 1,000,000 pixels
export const PRICE_PER_PIXEL = 0.50; // $0.50 per pixel (2 pixels = $1.00)

// 32-color Neo-Brutalist & Retro 8-bit Palette
export const NEO_BRUTALIST_PALETTE = [
  '#000000', // Black
  '#FFFFFF', // Pure White
  '#FAF8F5', // Cream White
  '#FF6B6B', // Coral Red
  '#EE5253', // Deep Red
  '#FF9F43', // Orange Amber
  '#FFA97A', // Tangerine Peach
  '#FFE169', // Canary Yellow
  '#FED766', // Mustard Yellow
  '#1DD1A1', // Emerald Green
  '#10AC84', // Dark Emerald
  '#4ECDC4', // Mint Aqua
  '#00D2D3', // Bright Cyan
  '#54A0FF', // Sky Blue
  '#2E86DE', // Royal Blue
  '#5F27CD', // Electric Purple
  '#A388EE', // Lavender Lilac
  '#FF9FF3', // Bubblegum Pink
  '#F368E0', // Deep Magenta
  '#8395A7', // Slate Gray
  '#576574', // Charcoal Gray
  '#222f3e', // Midnight Navy
  '#C8D6E5', // Cloud Gray
  '#8B572A', // Earth Brown
  '#BD10E0', // Neon Violet
  '#7ED321', // Lime Green
  '#B8E986', // Pastel Lime
  '#9013FE', // Royal Purple
  '#D0021B', // Crimson
  '#F5A623', // Gold
  '#4A90E2', // Ocean Blue
  '#333333', // Deep Gray
];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Helper to check if two bounding boxes collide
export function checkCollision(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export function rectsOverlap(r1: Rect, r2: Rect): boolean {
  return checkCollision(r1.x, r1.y, r1.width, r1.height, r2.x, r2.y, r2.width, r2.height);
}

// Subtract rectangle B from rectangle A, returning non-overlapping sub-rectangles
export function subtractRect(A: Rect, B: Rect): Rect[] {
  if (!rectsOverlap(A, B)) {
    return [A];
  }

  const intX1 = Math.max(A.x, B.x);
  const intY1 = Math.max(A.y, B.y);
  const intX2 = Math.min(A.x + A.width, B.x + B.width);
  const intY2 = Math.min(A.y + A.height, B.y + B.height);

  const result: Rect[] = [];

  // Top piece
  if (intY1 > A.y) {
    result.push({
      x: A.x,
      y: A.y,
      width: A.width,
      height: intY1 - A.y,
    });
  }

  // Bottom piece
  if (intY2 < A.y + A.height) {
    result.push({
      x: A.x,
      y: intY2,
      width: A.width,
      height: A.y + A.height - intY2,
    });
  }

  // Left piece
  if (intX1 > A.x) {
    result.push({
      x: A.x,
      y: intY1,
      width: intX1 - A.x,
      height: intY2 - intY1,
    });
  }

  // Right piece
  if (intX2 < A.x + A.width) {
    result.push({
      x: intX2,
      y: intY1,
      width: A.x + A.width - intX2,
      height: intY2 - intY1,
    });
  }

  return result.filter((r) => r.width > 0 && r.height > 0);
}

// Subtract multiple clippers from a list of subject rectangles
export function subtractRects(subjects: Rect[], clippers: Rect[]): Rect[] {
  let current = subjects;
  for (const clip of clippers) {
    const next: Rect[] = [];
    for (const subj of current) {
      next.push(...subtractRect(subj, clip));
    }
    current = next;
  }
  return current;
}

// Check if a selection collides with any plots and dynamically add or unselect regions
export function applyDragSelection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  existingPlots: Plot[],
  existingRegions: SelectionRegion[] = [],
  forceAction?: 'add' | 'remove'
): PixelSelection | null {
  const minX = Math.max(0, Math.min(Math.round(startX), Math.round(endX)));
  const maxX = Math.min(CANVAS_WIDTH - 1, Math.max(Math.round(startX), Math.round(endX)));
  const minY = Math.max(0, Math.min(Math.round(startY), Math.round(endY)));
  const maxY = Math.min(CANVAS_HEIGHT - 1, Math.max(Math.round(startY), Math.round(endY)));

  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const rawDragRect: Rect = { x: minX, y: minY, width, height };

  // 1. Identify all colliding plots & subtract owned plots
  const collidingPlots: Plot[] = [];
  let totalOverlapPixels = 0;

  for (const plot of existingPlots) {
    if (rectsOverlap(rawDragRect, plot)) {
      collidingPlots.push(plot);
      const ox1 = Math.max(rawDragRect.x, plot.x);
      const oy1 = Math.max(rawDragRect.y, plot.y);
      const ox2 = Math.min(rawDragRect.x + rawDragRect.width, plot.x + plot.width);
      const oy2 = Math.min(rawDragRect.y + rawDragRect.height, plot.y + plot.height);
      if (ox2 > ox1 && oy2 > oy1) {
        totalOverlapPixels += (ox2 - ox1) * (oy2 - oy1);
      }
    }
  }

  // Free unowned pieces from this drag rectangle
  const freePieces = subtractRects(
    [rawDragRect],
    collidingPlots.map((p) => ({ x: p.x, y: p.y, width: p.width, height: p.height }))
  );

  // Check if drag started inside an already selected region
  const dragStartedInside = existingRegions.some(
    (r) => startX >= r.x && startX < r.x + r.width && startY >= r.y && startY < r.y + r.height
  );

  // Check if rawDragRect overlaps with any existing selected region
  const hasOverlapWithExisting = existingRegions.some((r) => rectsOverlap(r, rawDragRect));

  // Determine resulting rects
  let resultingRects: Rect[] = [];

  if (forceAction === 'remove' || dragStartedInside) {
    // Unselect mode: subtract drag rect from existing regions
    resultingRects = subtractRects(
      existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
      [rawDragRect]
    );
  } else if (forceAction === 'add') {
    // Pure add mode: add free pieces not already selected
    const nonDuplicatePieces = subtractRects(
      freePieces,
      existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
    );
    resultingRects = [
      ...existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
      ...nonDuplicatePieces,
    ];
  } else {
    // Dynamic Mode:
    // If dragging over already selected pixels: unselect them!
    // If dragging over unselected areas: add them!
    if (hasOverlapWithExisting) {
      // 1. Subtract drag rect from existing regions (unselect overlapping selected pixels)
      const survivingExisting = subtractRects(
        existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
        [rawDragRect]
      );
      // 2. Add any free unselected pieces in the drag rectangle that were NOT previously selected
      const newPiecesToAdd = subtractRects(
        freePieces,
        existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
      );
      resultingRects = [...survivingExisting, ...newPiecesToAdd];
    } else {
      // Dragged over an area with no existing selection: add this new area
      resultingRects = [
        ...existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
        ...freePieces,
      ];
    }
  }

  // Filter out any zero-sized rectangles
  const validRects = resultingRects.filter((r) => r.width > 0 && r.height > 0);

  if (validRects.length === 0) {
    return null;
  }

  const updatedRegions: SelectionRegion[] = validRects.map((r, idx) => ({
    id: `region_${r.x}_${r.y}_${r.width}_${r.height}_${idx}`,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    pixelCount: r.width * r.height,
    cost: r.width * r.height * PRICE_PER_PIXEL,
  }));

  const totalValidPixels = updatedRegions.reduce((sum, r) => sum + r.pixelCount, 0);
  const boundingBox = computeBoundingBox(updatedRegions, minX, minY, width, height);

  let notificationMessage: string | undefined = undefined;
  if (totalOverlapPixels > 0) {
    notificationMessage = `Notice: Automatically excluded ${totalOverlapPixels.toLocaleString()} already-owned pixel${
      totalOverlapPixels === 1 ? '' : 's'
    }. Remaining ${totalValidPixels.toLocaleString()} unpainted pixels selected!`;
  }

  return {
    startX,
    startY,
    endX,
    endY,
    x: boundingBox.x,
    y: boundingBox.y,
    width: boundingBox.width,
    height: boundingBox.height,
    regions: updatedRegions,
    pixelCount: totalValidPixels,
    cost: totalValidPixels * PRICE_PER_PIXEL,
    hasCollision: false,
    collidingPlots: collidingPlots.map((p) => p.id),
    excludedOwnedPixelsCount: totalOverlapPixels,
    notificationMessage,
    excludedPlotTitles: collidingPlots.map((p) => p.title),
  };
}

// Backward-compatible wrapper for evaluateSelection
export function evaluateSelection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  existingPlots: Plot[],
  existingRegions: SelectionRegion[] = [],
  action: 'add' | 'remove' = 'add'
): PixelSelection {
  const result = applyDragSelection(startX, startY, endX, endY, existingPlots, existingRegions, action);
  if (!result) {
    const minX = Math.max(0, Math.min(Math.round(startX), Math.round(endX)));
    const minY = Math.max(0, Math.min(Math.round(startY), Math.round(endY)));
    return {
      startX,
      startY,
      endX,
      endY,
      x: minX,
      y: minY,
      width: 0,
      height: 0,
      regions: [],
      pixelCount: 0,
      cost: 0,
      hasCollision: false,
      collidingPlots: [],
      excludedOwnedPixelsCount: 0,
    };
  }
  return result;
}

function computeBoundingBox(
  regions: SelectionRegion[],
  fallbackX: number,
  fallbackY: number,
  fallbackW: number,
  fallbackH: number
): Rect {
  if (regions.length === 0) {
    return { x: fallbackX, y: fallbackY, width: fallbackW, height: fallbackH };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of regions) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

// Convert HEX string to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert RGB to HEX
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase()
  );
}

// Image to pixel art conversion
export function processImageToPixels(
  imageFile: File,
  targetWidth: number,
  targetHeight: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = targetWidth;
        offscreen.height = targetHeight;
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
        const pixels: string[] = [];

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // If fully transparent, default to white
          if (a < 50) {
            pixels.push('#FAF8F5');
          } else {
            pixels.push(rgbToHex(r, g, b));
          }
        }
        resolve(pixels);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(imageFile);
  });
}

// Multi-region image placement: spans across entire selection bounding box or fits each region
export function processImageToRegions(
  imageFile: File,
  regions: SelectionRegion[],
  placementMode: 'span' | 'fit' = 'span'
): Promise<Map<string, string[]>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const result = new Map<string, string[]>();

        if (regions.length === 0) {
          resolve(result);
          return;
        }

        if (placementMode === 'fit' || regions.length === 1) {
          // Fit image to each individual region
          regions.forEach((region) => {
            const offscreen = document.createElement('canvas');
            offscreen.width = region.width;
            offscreen.height = region.height;
            const ctx = offscreen.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0, region.width, region.height);
              const imgData = ctx.getImageData(0, 0, region.width, region.height).data;
              const pxs: string[] = [];
              for (let i = 0; i < imgData.length; i += 4) {
                const r = imgData[i];
                const g = imgData[i + 1];
                const b = imgData[i + 2];
                const a = imgData[i + 3];
                pxs.push(a < 50 ? '#FAF8F5' : rgbToHex(r, g, b));
              }
              result.set(region.id, pxs);
            }
          });
          resolve(result);
          return;
        }

        // 'span' mode: map image across the overall bounding box of all regions
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        regions.forEach((r) => {
          minX = Math.min(minX, r.x);
          minY = Math.min(minY, r.y);
          maxX = Math.max(maxX, r.x + r.width);
          maxY = Math.max(maxY, r.y + r.height);
        });
        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);

        const offscreen = document.createElement('canvas');
        offscreen.width = bboxW;
        offscreen.height = bboxH;
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, bboxW, bboxH);

        // For each region, sample its sub-rectangle from the bounding box canvas
        regions.forEach((region) => {
          const rx = region.x - minX;
          const ry = region.y - minY;
          const imgData = ctx.getImageData(rx, ry, region.width, region.height).data;
          const pxs: string[] = [];
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];
            pxs.push(a < 50 ? '#FAF8F5' : rgbToHex(r, g, b));
          }
          result.set(region.id, pxs);
        });

        resolve(result);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(imageFile);
  });
}

// Generate demo seed plots to make the canvas vibrant and engaging immediately
export function getInitialSeedPlots(): Plot[] {
  const seedPlots: Plot[] = [];

  // Plot 1: Center Neo-Brutalist Mascot & Welcome Banner
  const createPatternPlot = (
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    ownerUsername: string,
    ownerProfileId: string,
    title: string,
    note: string,
    linkUrl: string,
    bg: string,
    fg: string,
    accent: string
  ): Plot => {
    const pixels: string[] = [];
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        // Border
        if (px === 0 || px === w - 1 || py === 0 || py === h - 1) {
          pixels.push('#000000');
        } else if (px === 1 || py === 1) {
          pixels.push(accent);
        } else if ((px + py) % 4 === 0) {
          pixels.push(fg);
        } else {
          pixels.push(bg);
        }
      }
    }

    return {
      id,
      ownerId: 'seed_' + ownerUsername,
      ownerUsername,
      ownerProfileId,
      ownerPhotoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${ownerUsername}`,
      x,
      y,
      width: w,
      height: h,
      pixelCount: w * h,
      pricePaid: w * h * PRICE_PER_PIXEL,
      title,
      note,
      linkUrl,
      pixels,
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 86400000 * 3,
    };
  };

  // 1. Genesis Pixel Flag at Center (X: 480, Y: 480, 40x40 = 1,600 px = $800)
  seedPlots.push(
    createPatternPlot(
      'plot_genesis_center',
      480,
      480,
      40,
      40,
      'satoshidraws',
      '#PX-0001',
      '⚡ The Genesis Block Plot',
      'Welcome to the 1 Million Dollar Canvas! Immortalize your art, brand, or signature on the digital canvas forever.',
      'https://github.com',
      '#FFE169',
      '#FF6B6B',
      '#FFFFFF'
    )
  );

  // 2. Neo-Brutalist Burger Guild (X: 530, Y: 480, 30x30 = 900 px = $450)
  seedPlots.push(
    createPatternPlot(
      'plot_burger_guild',
      530,
      480,
      30,
      30,
      'pixelburger',
      '#PX-0042',
      '🍔 The Neo Burger Club',
      'Serving hot, juicy pixels straight from the retro kitchen. 100% grass-fed digital beef!',
      'https://themilliondollardrawing.com',
      '#FFA97A',
      '#BD10E0',
      '#FED766'
    )
  );

  // 3. Cyber Star Studio (X: 430, Y: 480, 30x30 = 900 px = $450)
  seedPlots.push(
    createPatternPlot(
      'plot_cyber_star',
      430,
      480,
      30,
      30,
      'stargazer',
      '#PX-0777',
      '✨ Stargazer Constellation',
      'Plotting coordinates into deep cyber space. Shoutout to all digital artists exploring the frontier!',
      'https://google.com',
      '#4ECDC4',
      '#5F27CD',
      '#FFFFFF'
    )
  );

  // 4. Tokyo Pixel Art Lab (X: 480, Y: 430, 40x30 = 1,200 px = $600)
  seedPlots.push(
    createPatternPlot(
      'plot_tokyo_pixel',
      480,
      430,
      40,
      30,
      'tokyo_pixels',
      '#PX-1337',
      '🌸 Neo Tokyo Cyberpunk Oasis',
      'Greetings from Shibuya! Building the future of collaborative canvas real estate.',
      'https://news.ycombinator.com',
      '#FF9FF3',
      '#1DD1A1',
      '#000000'
    )
  );

  // 5. Emerald Tiger DAO (X: 480, Y: 530, 40x30 = 1,200 px = $600)
  seedPlots.push(
    createPatternPlot(
      'plot_emerald_dao',
      480,
      530,
      40,
      30,
      'emeraldtiger',
      '#PX-8888',
      '🐅 Emerald Tiger Collective',
      'Dedicated to preserving wildlife through digital art donations. Every pixel counts.',
      'https://worldwildlife.org',
      '#1DD1A1',
      '#FFE169',
      '#222F3E'
    )
  );

  return seedPlots;
}
