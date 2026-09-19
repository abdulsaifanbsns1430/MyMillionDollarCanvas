import { Plot, PixelSelection } from '../types';

export const CANVAS_WIDTH = 2000;
export const CANVAS_HEIGHT = 2000;
export const TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT; // 4,000,000 pixels
export const PRICE_PER_PIXEL = 0.25; // $0.25 per pixel (4 pixels = $1.00)

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

// Check if a selection collides with any plots
export function evaluateSelection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  existingPlots: Plot[]
): PixelSelection {
  const minX = Math.max(0, Math.min(Math.round(startX), Math.round(endX)));
  const maxX = Math.min(CANVAS_WIDTH - 1, Math.max(Math.round(startX), Math.round(endX)));
  const minY = Math.max(0, Math.min(Math.round(startY), Math.round(endY)));
  const maxY = Math.min(CANVAS_HEIGHT - 1, Math.max(Math.round(startY), Math.round(endY)));

  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const pixelCount = width * height;
  const cost = pixelCount * PRICE_PER_PIXEL;

  const collidingPlots: string[] = [];
  for (const plot of existingPlots) {
    if (checkCollision(minX, minY, width, height, plot.x, plot.y, plot.width, plot.height)) {
      collidingPlots.push(plot.id);
    }
  }

  return {
    startX,
    startY,
    endX,
    endY,
    x: minX,
    y: minY,
    width,
    height,
    pixelCount,
    cost,
    hasCollision: collidingPlots.length > 0,
    collidingPlots,
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

  // 1. Genesis Pixel Flag at Center (X: 980, Y: 980, 40x40 = 1,600 px = $400)
  seedPlots.push(
    createPatternPlot(
      'plot_genesis_center',
      980,
      980,
      40,
      40,
      'satoshidraws',
      '#PX-0001',
      '⚡ The Genesis Block Plot',
      'Welcome to the 4 Million Dollar Canvas! Immortalize your art, brand, or signature on the digital canvas forever.',
      'https://github.com',
      '#FFE169',
      '#FF6B6B',
      '#FFFFFF'
    )
  );

  // 2. Neo-Brutalist Burger Guild (X: 1030, Y: 980, 30x30 = 900 px = $225)
  seedPlots.push(
    createPatternPlot(
      'plot_burger_guild',
      1030,
      980,
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

  // 3. Cyber Star Studio (X: 930, Y: 980, 30x30 = 900 px = $225)
  seedPlots.push(
    createPatternPlot(
      'plot_cyber_star',
      930,
      980,
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

  // 4. Tokyo Pixel Art Lab (X: 980, Y: 930, 40x30 = 1,200 px = $300)
  seedPlots.push(
    createPatternPlot(
      'plot_tokyo_pixel',
      980,
      930,
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

  // 5. Emerald Tiger DAO (X: 980, Y: 1030, 40x30 = 1,200 px = $300)
  seedPlots.push(
    createPatternPlot(
      'plot_emerald_dao',
      980,
      1030,
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
