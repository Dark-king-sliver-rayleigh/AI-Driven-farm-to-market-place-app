# Design System Strategy: The Editorial Harvest

## 1. Overview & Creative North Star
The North Star for this design system is **"The Agrarian Atelier."** 

We are moving away from the "SaaS dashboard" aesthetic and toward a premium editorial experience. This system treats agricultural data and commerce with the same reverence as a high-end fashion or architectural journal. We achieve this through **Asymmetric Tension**—intentional imbalance that guides the eye—and **Negative Space as a Component**, where emptiness is treated as a structural element rather than a void. By eschewing cards and borders, we create a fluid, infinite canvas that feels bespoke and authoritative.

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in deep earth tones (`Zinc-950`) and crisp whites (`#f9fafb`), punctuated by a vibrant, life-giving `Emerald-600`.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections or containers. Separation must be achieved through:
- **Background Color Shifts:** Use `surface-container-low` (#f3f4f5) against `surface` (#f8f9fa) to define regions.
- **Asymmetric Spacing:** Use drastic shifts in padding to imply hierarchy.
- **Sidebar Contrast:** The `Zinc-950` sidebar acts as the "anchor," allowing the `Off-white` main stage to feel expansive and unconfined.

### Surface Hierarchy & Nesting
Instead of shadows, use the surface-container tiers to create "stacked" depth:
- **Base Layer:** `surface` (#f8f9fa)
- **Content Blocks:** `surface-container-low` (#f3f4f5)
- **Elevated Interactive Elements:** `surface-container-lowest` (#ffffff)
- **Global Navigation:** `inverse_surface` (#2e3132 / Zinc-950)

### Signature Textures
Main CTAs and Hero accents should utilize a subtle gradient transition from `primary` (#006948) to `primary_container` (#00855d). This adds a "silk-screened" depth to the Emerald elements, preventing them from feeling like flat digital stickers.

## 3. Typography: The Editorial Voice
We utilize a sophisticated scale that balances the technical precision of `Satoshi` (as requested for brand identity) with the readability of our tokenized scale.

- **Display & Headlines (Satoshi Bold):** These are your "hooks." Use `display-lg` and `headline-lg` with tight letter-spacing (-0.02em) to create a bold, editorial impact.
- **Title & Body (Satoshi Regular/Semibold):** Titles should use `title-lg` in Semibold for clarity. Body text (`body-md`) remains Regular with generous line-height (1.6) to ensure the "breathing room" requested.
- **Labeling:** Use `label-md` in `Zinc-500` (secondary) for all metadata. This creates a clear visual distinction between data and narrative.

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are largely replaced by **Tonal Layering**. We want the UI to feel like a series of fine paper sheets layered atop one another.

- **The Layering Principle:** To highlight a specific section without using a card, shift the background to `surface_container_highest` (#e1e3e4). This "indents" the content into the page.
- **Ambient Shadows:** Only for floating modals or popovers. Use a 4% opacity shadow with a 40px blur, tinted with `primary` (#006948) to mimic the way light filters through foliage.
- **The "Ghost Border" Fallback:** If a field requires a boundary (like inputs), use the `outline_variant` (#bccac0) at 20% opacity. Never use high-contrast black or grey lines.
- **Glassmorphism:** For floating headers or navigation overlays, use `surface` at 80% opacity with a 20px `backdrop-blur`.

## 5. Components: Primitive Styling

### Buttons
- **Primary:** Solid `Emerald-600` (`primary`). Radius: `full`. No shadow. Typography: `label-md` white, Uppercase, Bold.
- **Secondary:** Transparent background with `Emerald-600` text. Hover state: `surface-container-low`.
- **Tertiary:** `Zinc-500` text with a subtle underline that expands on hover.

### Pill-Shaped Inputs
- **Container:** `Zinc-100` background, `Zinc-200` Ghost Border (20% opacity).
- **Shape:** `full` (pill).
- **Focus State:** `emerald-500` outline, 2px thickness, with a soft emerald glow (4% opacity).
- **Typography:** `body-md` in `Zinc-900`.

### Lists & Navigation
- **The "No-Divider" Rule:** Forbid 1px dividers between list items. Instead, use a 12px vertical gap. On hover, the entire row should transition to `surface-container-low` with a `lg` (2rem) corner radius.
- **Icons:** Phosphor Icons only. Use "Regular" weight for navigation and "Thin" weight for decorative elements. Never mix weights on the same screen.

### Editorial "Asymmetric" Grid
Instead of a standard 12-column grid, use an offset layout. For example, a page title may occupy 4 columns on the left, while the main content starts at column 6, leaving column 5 as intentional white space.

## 6. Do's and Don'ts

### Do
- **Do** use large images of high-quality agriculture photography that "break" the grid and bleed off the screen edges.
- **Do** use `Zinc-500` for all non-essential information to keep the interface from feeling cluttered.
- **Do** rely on alignment (left-justified) to create structure since borders are absent.

### Don't
- **Don't** use cards. If information needs to be grouped, use a subtle background color shift or increased negative space.
- **Don't** use emojis. The brand is professional and premium; stick to the curated Phosphor icon set.
- **Don't** use standard "Success Green." Always use the brand `Emerald-600` to maintain the signature visual identity.
- **Don't** center-align long-form text. Editorial design relies on strong left-hand "anchors."