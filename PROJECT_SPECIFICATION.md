# Million Dollar Canvas (4 Million Pixels) — Project Specification & Architecture Plan

## 1. Executive Summary & Concept Analysis

### 1.1 The Inspiration: themilliondollardrawing.com & Million Dollar Homepage
The Million Dollar Drawing is a collaborative digital art project where a finite grid of pixels is permanently claimable and painted by users across the world. Each pixel represents permanent internet real estate where users can immortalize their art, brand, personal message, or tribute, complete with an interactive note popup that appears when any visitor clicks on their territory.

### 1.2 The Million Dollar Canvas Equation & Economics
* **Canvas Dimensions**: **2,000 × 2,000 pixels** = **4,000,000 total pixels** (4 Million Pixels).
* **Unit Economics**: **$0.25 per pixel** (Exactly **4 pixels = $1.00**).
* **Total Value of Canvas**: 4,000,000 pixels × $0.25 = **$1,000,000.00 USD**.
* **Flexible Purchasing**:
  * Users can purchase single pixels (1 px = $0.25) or rectangular blocks (e.g., 2×2 = 4 px for $1.00, 10×10 = 100 px for $25.00, 20×20 = 400 px for $100.00, 50×50 = 2,500 px for $625.00).
  * Collisions are strictly blocked: users cannot purchase pixels already owned by others.
* **Perks of Ownership**:
  * **Interactive Note**: Owners can attach a title, personal note/story, and external link that pops up in a Neo-Brutalist window when clicked.
  * **Free Lifetime Re-painting**: Owners can freely edit the artwork, colors, or message on their owned pixels at any time without paying additional fees.

---

## 2. Visual Identity & Neo-Brutalism Design Analysis

### 2.1 Comparative Analysis of the 3 Provided Design References
1. **Image 1 (Button System)**:
   * Focuses on standalone vibrant action buttons (Cyan, Red, Yellow, Green, Pink, Purple, Lime, etc.) with 2-3px solid black borders and 4px offset solid drop-shadows (`box-shadow: 4px 4px 0px #000000`).
2. **Image 2 (Mobile Screen Illustration)**:
   * Features playful retro cartoon mascots with pastel background cards (#FFE8A3 yellow, #D1F884 lime, #FFBFE1 pink), heavy rounded pills, and pill-shaped navigation bars.
3. **Image 3 (Neo-Brutalism UI Component Library - THE CHOSEN DESIGN)**:
   * **Why it is the superior choice**: It is a complete, mature design system specifically structured for complex desktop & mobile web applications. It pairs:
     * **Crisp Light Theme Palette**: Warm cream canvas `#FFFDF7` / `#F7F4EB`, contrasting with crisp white `#FFFFFF` cards and vibrant candy accents.
     * **Hard Geometry & Tactile Shadows**: Pure black borders (`border-2 border-black` / `border-[2.5px] border-black`) paired with sharp, non-blurred offset shadows (`shadow-[4px_4px_0px_#000]`).
     * **Harmonious Accent Palette**:
       * **Primary Coral / Red**: `#FF6B6B` (Buttons, alerts, active tags)
       * **Canary Yellow**: `#FFE169` / `#FED766` (Highlights, notice banners, warnings)
       * **Mint Aqua**: `#4ECDC4` / `#7BE4D5` (Success, pixel selection state, active toggles)
       * **Soft Lilac / Purple**: `#A388EE` / `#C4B5FD` (Profile pills, VIP badges)
       * **Peach Tangerine**: `#FFA97A` (Leaderboard top spots, stats)
     * **Mathematical Corner Nesting**: Outer card corners rounded at 12–14px (`rounded-xl` or `rounded-2xl`) with inner buttons/inputs mathematically nested.
     * **Expressive Typography**: Bold display headers (Space Grotesk / Plus Jakarta Sans 800) with ultra-readable geometric body text.

---

## 3. High-Performance Canvas Architecture (Zero-Lag Engine)

Handling 4,000,000 pixels with smooth 60fps pan/zoom and instant drag interactions requires specialized canvas architecture:

### 3.1 Why DOM Nodes Fail & Canvas Wins
* Rendering 4,000,000 HTML elements or SVGs would freeze modern browsers and consume gigabytes of memory.
* Solution: **Dual-Layer HTML5 Canvas Architecture** with **Spatial Virtualization (Viewport Culling)**:
  1. **Background / Pixel Data Layer**:
     * An offscreen `ImageData` buffer / `Uint32Array` representing the 2000×2000 pixel color state in memory (only ~16 MB of uncompressed memory, extremely light!).
     * Rendered to a hardware-accelerated `<canvas>` using 2D context with `image-rendering: pixelated` and `imageSmoothingEnabled = false` for razor-sharp pixel edges at any zoom level.
  2. **Interactive Overlay Layer**:
     * A second transparent canvas positioned above the base canvas handles high-frequency user interactions:
       * Hover crosshair & coordinate readout (X: 1420, Y: 890).
       * Dynamic drag-selection box with animated dashed marching ants or neo-brutalist marquee.
       * Pixel ownership boundary outlines (highlighting plots).
       * Pixel grid lines (rendered cleanly when zoom level > 6x to avoid visual noise at bird's-eye view).
  3. **Mini-Map / Radar Navigator**:
     * A compact 150×150px neo-brutalist floating radar widget showing the full 2000×2000 canvas in miniature, with an interactive viewport indicator rectangle that can be dragged to teleport anywhere on the canvas.

### 3.2 Viewport & Interaction Mechanics
* **Transform State**: Matrix `{ x: number, y: number, scale: number }`.
* **Zoom Range**: 0.25x (view entire 2000×2000 canvas) to 32x (inspect and paint individual single pixels).
* **Smooth Navigation**:
  * **Desktop**: Mouse wheel to zoom (centered at cursor), Click & Drag (with Middle Click or Spacebar / Pan mode) to pan smoothly.
  * **Mobile / Touch**: Two-finger pinch-to-zoom and two-finger pan, with single-finger touch-to-select / touch-to-paint.
* **Selection Modes**:
  * **Box Select**: Click/tap and drag across the canvas to define a rectangular region of pixels. Live HUD shows dimensions (e.g. 12 × 8), total pixels (96 px), and price ($24.00).
  * **Multi-Plot / Additive Selection**: Shift-drag or mobile "add mode" to add more pixels to the current cart.
  * **Collision Detector**: Any pixel in the selection that is already owned is dynamically flagged in red with a notice: *"X pixels in your selection are already claimed!"*.

---

## 4. User Onboarding, Authentication & Profile ID System

### 4.1 Authentication Flow
1. **Google Sign-In**:
   * Firebase Authentication via `signInWithPopup` (Google Auth Provider).
2. **First-Time Registration Gate (Profile ID & Unique Username)**:
   * If a user signs in for the first time, they are immediately greeted by a blocking Neo-Brutalism Modal:
     * **Unique Username**: 3–20 alphanumeric characters (`^[a-zA-Z0-9_]+$`). Live debounce validation verifies uniqueness in Firestore `usernames/{username}`.
     * **Custom Profile ID**: Unique identifier code (e.g., `#PIXEL-9021` or user-defined code).
     * **Profile Avatar**: Automatically imports their Google avatar or allows choosing a 16-color pixel avatar icon.
     * **Bio / Owner Signature**: Short 100-character description or motto.
   * Only once this profile is completed and written to Firestore can the user access the main canvas purchasing features.

---

## 5. Pixel Ownership, Interactive Notes & Re-Painting

### 5.1 Interactive Pixel Note Popup
* When any visitor clicks on an owned pixel or plot:
  * A Neo-Brutalist Card Modal pops up at the click location or centered on screen:
    * **Plot Header**: Coordinates `(X: 512, Y: 1024)`, Plot Size (e.g. `20 × 20 = 400 Pixels`).
    * **Owner Card**: Owner Username, Profile ID, Avatar badge, Purchase Date.
    * **Owner's Note**: Full custom message left by the owner.
    * **Owner's Link**: Optional verified external link (opens in new tab) with custom link text.
    * **"Edit Artwork" Button**: Visible *only* if `currentUser.uid === ownerUid`.

### 5.2 Ownership Editing & Paint Studio
* When an owner opens their plot in Edit Mode:
  * The canvas zooms in to their plot with a highlighted Neo-Brutalism gold marquee border.
  * A **Pixel Paint Toolbar** opens:
    * **Color Palette**: Preset 32 retro/neo-brutalist curated colors + Hex color picker.
    * **Drawing Tools**: 1px Pencil, Eraser, Fill Bucket, Eye Dropper (Color Picker).
    * **Image to Pixel Art Converter**: Option to upload a small image/logo (e.g., 20×20) that is automatically quantised into pixel colors fitting their plot!
    * **Update Note**: Change the note text and website URL anytime.
    * **Save Changes**: Instantly syncs the updated pixels and note to Firestore.

---

## 6. Top 50 Leaderboard

### 6.1 Leaderboard Metrics
* **Rankings**: Sorted descending by `totalPixelsBought` (Top 50).
* **Display Fields**:
  * Rank (#1 to #50) with trophy / medal icons for Top 3.
  * Username & Unique Profile ID.
  * Total Pixels Owned (e.g. `14,250 px`).
  * Total Investment (e.g. `$3,562.50`).
  * Canvas Dominance Percentage (`(pixels / 4,000,000) * 100%`).
  * "Inspect on Canvas" button: Clicking automatically animates and smoothly pans the main canvas directly to that user's largest plot!

---

## 7. Database & Firestore Architecture

### 7.1 Firestore Collections
1. **`users/{userId}`**:
   * `userId`: string
   * `username`: string (unique, indexed)
   * `profileId`: string (unique)
   * `displayName`: string
   * `photoURL`: string
   * `totalPixelsBought`: number
   * `totalSpent`: number
   * `createdAt`: timestamp
   * `updatedAt`: timestamp

2. **`usernames/{username}`**:
   * Document ID: lowercase username (enforces atomic uniqueness)
   * `userId`: string
   * `claimedAt`: timestamp

3. **`plots/{plotId}`**:
   * `plotId`: string (e.g., `plot_x200_y450_w20_h20`)
   * `ownerId`: string (User UID)
   * `ownerUsername`: string
   * `x`: number (0 to 1999)
   * `y`: number (0 to 1999)
   * `width`: number
   * `height`: number
   * `pixelCount`: number
   * `pricePaid`: number
   * `note`: string (max 500 chars)
   * `linkUrl`: string (optional, max 200 chars)
   * `pixelsData`: string (compressed RLE or hex pixel matrix for the plot)
   * `createdAt`: timestamp
   * `updatedAt`: timestamp

4. **`orders/{orderId}`**:
   * `orderId`: string
   * `userId`: string
   * `plotId`: string
   * `pixelsCount`: number
   * `amount`: number
   * `status`: 'completed'
   * `timestamp`: timestamp

5. **`canvas_chunks/{chunkId}`** (Spatial Chunking for high-speed network sync):
   * Canvas divided into 10×10 chunks of 200×200 pixels (total 100 chunks).
   * Enables lightweight incremental loading and real-time synchronization without transferring 4 million pixels in a single payload.

---

## 8. Step-by-Step Implementation Roadmap

1. **Architecture & Specification**: Complete specifications, color tokens, and layout schemas.
2. **Firebase Provisioning & Auth Setup**:
   * Request Firebase setup via `set_up_firebase` following the skill guidelines.
   * Configure Google Sign-in and Firestore.
3. **Core Neo-Brutalist Light UI Shell**:
   * Top Header with Canvas stats (Total Claimed, Remaining, Live Valuation, Sign-In / User Profile).
   * Floating Toolbar: Navigation mode, Selection mode, Draw mode, Zoom Controls, Coordinates HUD, Leaderboard Drawer toggle.
   * Mini-map / Radar in the bottom corner.
4. **High-Performance 2,000 × 2,000 Canvas Engine**:
   * Offscreen virtual buffer, WebGL/2D viewport rendering, smooth pan/zoom, coordinate transformation math.
   * Drag-selection bounding box with live pixel calculation ($0.25/pixel) and collision checks.
5. **Interactive Note & Inspector Window**:
   * Neo-brutalist popover modal on plot click with user info, note, link, and owner edit action.
6. **Pixel Paint Studio & Editor**:
   * 32-color palette, eyedropper, pencil, bucket, and image stamp tools for plot owners.
7. **Leaderboard & Search System**:
   * Top 50 leaderboard modal/drawer with "Jump to Plot" navigation.
   * Search bar to locate users or coordinate (X, Y).
8. **Testing, Linting & Build Verification**:
   * Production build testing with `compile_applet` and `lint_applet`.
