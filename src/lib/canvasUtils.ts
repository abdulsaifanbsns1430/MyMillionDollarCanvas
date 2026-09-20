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

// Check if two rectangles touch or overlap (Chebyshev distance <= 1 px)
export function rectsTouchOrOverlap(r1: Rect, r2: Rect): boolean {
  return (
    r1.x <= r2.x + r2.width &&
    r1.x + r1.width >= r2.x &&
    r1.y <= r2.y + r2.height &&
    r1.y + r1.height >= r2.y
  );
}

// Group touching/adjacent rectangles into connected components
export function groupConnectedRectangles(rects: Rect[]): Rect[][] {
  if (rects.length <= 1) return rects.map((r) => [r]);

  const n = rects.length;
  const visited = new Array(n).fill(false);
  const groups: Rect[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const group: Rect[] = [];
    const queue: number[] = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const curIdx = queue.shift()!;
      group.push(rects[curIdx]);

      for (let j = 0; j < n; j++) {
        if (!visited[j] && rectsTouchOrOverlap(rects[curIdx], rects[j])) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }
    groups.push(group);
  }

  return groups;
}

export interface BoundarySegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Compute only the external perimeter boundary edges of the union of all rectangles,
// eliminating all internal divider lines between touching/adjacent rectangles!
export function computeSelectionBoundarySegments(regions: Rect[]): BoundarySegment[] {
  if (!regions || regions.length === 0) return [];

  const pixelSet = new Set<string>();
  for (const r of regions) {
    for (let py = r.y; py < r.y + r.height; py++) {
      for (let px = r.x; px < r.x + r.width; px++) {
        pixelSet.add(`${px},${py}`);
      }
    }
  }

  const hEdges = new Map<string, boolean>();
  const vEdges = new Map<string, boolean>();

  for (const key of pixelSet) {
    const comma = key.indexOf(',');
    const px = Number(key.substring(0, comma));
    const py = Number(key.substring(comma + 1));

    // Top edge at y = py
    if (!pixelSet.has(`${px},${py - 1}`)) {
      hEdges.set(`${py}:${px}`, true);
    }
    // Bottom edge at y = py + 1
    if (!pixelSet.has(`${px},${py + 1}`)) {
      hEdges.set(`${py + 1}:${px}`, true);
    }
    // Left edge at x = px
    if (!pixelSet.has(`${px - 1},${py}`)) {
      vEdges.set(`${px}:${py}`, true);
    }
    // Right edge at x = px + 1
    if (!pixelSet.has(`${px + 1},${py}`)) {
      vEdges.set(`${px + 1}:${py}`, true);
    }
  }

  const hSegments: { y: number; x1: number; x2: number }[] = [];
  const vSegments: { x: number; y1: number; y2: number }[] = [];

  // Group horizontal edges by Y coordinate
  const hByY = new Map<number, number[]>();
  for (const edgeKey of hEdges.keys()) {
    const colon = edgeKey.indexOf(':');
    const y = Number(edgeKey.substring(0, colon));
    const x = Number(edgeKey.substring(colon + 1));
    if (!hByY.has(y)) hByY.set(y, []);
    hByY.get(y)!.push(x);
  }

  for (const [y, xs] of hByY.entries()) {
    xs.sort((a, b) => a - b);
    let startX = xs[0];
    let prevX = xs[0];
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === prevX + 1) {
        prevX = xs[i];
      } else {
        hSegments.push({ y, x1: startX, x2: prevX + 1 });
        startX = xs[i];
        prevX = xs[i];
      }
    }
    hSegments.push({ y, x1: startX, x2: prevX + 1 });
  }

  // Group vertical edges by X coordinate
  const vByX = new Map<number, number[]>();
  for (const edgeKey of vEdges.keys()) {
    const colon = edgeKey.indexOf(':');
    const x = Number(edgeKey.substring(0, colon));
    const y = Number(edgeKey.substring(colon + 1));
    if (!vByX.has(x)) vByX.set(x, []);
    vByX.get(x)!.push(y);
  }

  for (const [x, ys] of vByX.entries()) {
    ys.sort((a, b) => a - b);
    let startY = ys[0];
    let prevY = ys[0];
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] === prevY + 1) {
        prevY = ys[i];
      } else {
        vSegments.push({ x, y1: startY, y2: prevY + 1 });
        startY = ys[i];
        prevY = ys[i];
      }
    }
    vSegments.push({ x, y1: startY, y2: prevY + 1 });
  }

  const result: BoundarySegment[] = [];
  for (const h of hSegments) {
    result.push({ x1: h.x1, y1: h.y, x2: h.x2, y2: h.y });
  }
  for (const v of vSegments) {
    result.push({ x1: v.x, y1: v.y1, x2: v.x, y2: v.y2 });
  }
  return result;
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

  if (forceAction === 'remove') {
    // Unselect/Erase mode: subtract drag rect from existing regions
    resultingRects = subtractRects(
      existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
      [rawDragRect]
    );
  } else {
    // Add mode (Default): Always add/union new unowned pixels without unselecting existing selections!
    const nonDuplicatePieces = subtractRects(
      freePieces,
      existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
    );
    resultingRects = [
      ...existingRegions.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
      ...nonDuplicatePieces,
    ];
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
  const connectedGroups = groupConnectedRectangles(validRects);
  const connectedAreaCount = connectedGroups.length;
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
    connectedAreaCount,
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

// Get a Set of "x,y" keys for all pixels in a selection
export function getSelectionPixelSet(selection: PixelSelection | null): Set<string> {
  const set = new Set<string>();
  if (!selection) return set;
  const regions = selection.regions && selection.regions.length > 0 ? selection.regions : [
    { x: selection.x, y: selection.y, width: selection.width, height: selection.height }
  ];
  for (const r of regions) {
    for (let py = r.y; py < r.y + r.height; py++) {
      for (let px = r.x; px < r.x + r.width; px++) {
        set.add(`${px},${py}`);
      }
    }
  }
  return set;
}

// Map an uploaded image file across the overall bounding box of selected pixels
export function mapImageToDraftPixels(
  imageFile: File,
  selection: PixelSelection
): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const result = new Map<string, string>();
        const regions = selection.regions && selection.regions.length > 0 ? selection.regions : [
          { id: '1', x: selection.x, y: selection.y, width: selection.width, height: selection.height, pixelCount: selection.pixelCount, cost: selection.cost }
        ];

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

        const pixelSet = getSelectionPixelSet(selection);
        const imgData = ctx.getImageData(0, 0, bboxW, bboxH).data;

        pixelSet.forEach((key) => {
          const [pxStr, pyStr] = key.split(',');
          const px = parseInt(pxStr, 10);
          const py = parseInt(pyStr, 10);
          const rx = px - minX;
          const ry = py - minY;

          if (rx >= 0 && rx < bboxW && ry >= 0 && ry < bboxH) {
            const idx = (ry * bboxW + rx) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            if (a < 50) {
              result.set(key, '#FAF8F5');
            } else {
              result.set(key, rgbToHex(r, g, b));
            }
          }
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

// Empty initial plots for a clean, fresh, real collaborative canvas
export function getInitialSeedPlots(): Plot[] {
  return [];
}
