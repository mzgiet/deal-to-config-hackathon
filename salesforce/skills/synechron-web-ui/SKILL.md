---
name: synechron-web-ui
description: "Synechron visual style for web UI in this repository — the dark brand theme of the Revenue Configurator (React + Tailwind in salesforce/configurator): palette tokens, background gradient, yellow accent rules, typography, buttons, cards, contrast. TRIGGER when: building or changing any screen, component or state of the configurator; adding colours, buttons, badges, cards or backgrounds; asked to make something 'look like Synechron', 'on brand' or 'in our style'; reviewing UI for brand fit. DO NOT TRIGGER when: writing slide decks (use the PowerPoint brand skill), writing prose or copy (use the editorial style skill), Slack Block Kit cards, or Apex/back-end work."
metadata:
  version: "1.0"
  domains: ["UI", "Tailwind", "Synechron brand", "Revenue Configurator"]
---

# Synechron web UI style

The configurator uses a **dark Synechron theme**: brand core blue background with a radial take on the brand
master gradient, white text, and Synechron yellow as the only accent, used sparingly. Everything below is
already implemented in `salesforce/configurator/tailwind.config.js` and `src/index.css`; this skill explains
how to use it so new work matches.

Sources: computed styles of synechron.com (home, About, Careers, an Insight article, Salesforce expertise,
Telecommunications industry, Contact) and the official Synechron brand book (core blue `#002535`, secondary
gradient blue `#0A5A78`, yellow `#FBF321`; "yellow sparingly"; CTAs without gradients or shadows).

## Rules that matter most

1. **Use the `syn-*` tokens, never raw hex or Tailwind palette colours** (`orange-500`, `purple-400`,
   `text-red-400`…). The only exceptions: framer-motion colour values come from `BRAND` in `src/theme.ts`, the
   yellow keyline arbitrary value `shadow-[inset_3px_0_0_#FBF321]`, and the range slider `accent-[#FBF321]`.
2. **Yellow is an accent, not a surface.** Use it for the primary CTA, the active state of a toggle/tab/pill, eyebrow
   labels, a slider, and thin keylines. Never for large fills, body text or backgrounds. One yellow CTA per view.
3. **No gradients on buttons**, no glow, no coloured shadows. The brand forbids them on CTAs. The only
   exceptions are keylines drawn with `box-shadow`: the inset yellow bar on active rows and the 1px
   `.card-glow` hover outline. Both are thin lines, not glows.
4. **Text sits on cards**, not directly on the bright corner of the page gradient. `syn-muted` on `#0A5A78` fails
   contrast (2.4:1).
5. **No purple, no orange.** The old `syn-orange` and `syn-purple` names still exist so legacy classes keep working,
   but they now hold yellow and secondary blue. Write `syn-accent` in new code, not `syn-orange`.

## Palette (tokens in `tailwind.config.js`)

| Token | Hex | Role | Source |
|---|---|---|---|
| `syn-bg` / `syn-primary` | `#002535` | Page base; text on yellow | Brand core blue; site `.bg-primary` |
| `syn-surface` | `#000E15` | Deepest panels inside a card (price panel) | Site footer and hero |
| `syn-card` | `#021922` | Cards | Site hero background |
| `syn-card-hover` | `#042430` | Hover on cards | Lighter end of the site's dark-card gradient |
| `syn-border` | `#142931` | Default borders | Site `rgba(255,255,255,.07)` over a card |
| `syn-border-bright` | `#35474E` | Inputs, switch off, active outlines | Site `rgba(255,255,255,.2)` over a card |
| `syn-text` | `#FFFFFF` | Primary text | — |
| `syn-secondary` | `#B2B4B4` | Secondary text | Site lead text and footer on dark |
| `syn-muted` | `#8F9292` | Labels, meta, hints | Site `#808282`, lightened to pass AA |
| `syn-accent` | `#FBF321` | The accent (see rule 2) | Brand yellow; site `.bg-accent` |
| `syn-on-accent` | `#002535` | Text and icons on yellow | Site `.btn-primary-revamp` |
| `syn-purple` / `syn-blue` | `#0A5A78` | Secondary blue: gradients, tints | Brand secondary gradient blue |
| `syn-purple-hover` | `#023D53` | Darker secondary blue | Site dark-card gradient |
| `syn-success` | `#A2E363` | Savings, "quote created", included items | Declared in the site CSS but not seen on visible elements; the brand book has no green. Chosen for AA on cards |
| `syn-danger` | `#FF8A80` | Errors | No brand error colour exists; chosen for AA on cards |

Gradients (`backgroundImage`):

- `bg-syn-gradient`: `linear-gradient(90deg, #002535 60%, #0A5A78)`, the brand master gradient (core blue
  at least 60%). Use it for dark bands and tiles, never for buttons.
- `bg-syn-gradient-subtle`: a secondary-blue tint fading to transparent. It marks the active row; always pair it
  with the yellow keyline bar.
- `bg-syn-gradient-card`: `#042430 → #000E15`, the site's dark-card gradient.

## Background

The page background is drawn by `body::before` in `index.css`: base `#002535` with soft `#0A5A78` spots in the top-right
(strong) and bottom-left (weak) corners. It uses a fixed pseudo-element, not `background-attachment: fixed`, so scrolling stays
smooth.

- **Don't put an opaque `bg-syn-bg` on page wrappers.** It hides the gradient. Let the `body` background show through.
- Don't add yellow glows to the background. The brand only mixes yellow into dark blue as thin keylines.
- Overlays use `bg-syn-bg/80 backdrop-blur-sm`, as in the "Not available" state.

## Yellow keylines (the brand "O" device idea)

The brand device is dark blue with thin yellow lines that fade to 0%. Don't redraw the device itself. Echo it with:

- `.keyline-bottom`: a 1px yellow line fading at both ends under a bar. It needs a positioned parent, e.g.
  `sticky` or `relative`.
- `shadow-[inset_3px_0_0_#FBF321]`: a 3px yellow bar on the left of the active row (the reached price band, an
  included bundle item).
- `.gradient-border`: a 1px yellow border fading to 0% toward the opposite corner.

## Typography

- Font: **Montserrat** (OFL), bundled through `@fontsource-variable/montserrat` and imported in `main.tsx`. Don't load
  fonts from Google Fonts. The bundle's own copy works under the Salesforce CSP.
- Page title (h1): `text-2xl md:text-3xl font-bold text-syn-text leading-snug`.
- Card title (h2): `text-lg font-semibold text-syn-text`.
- **Eyebrow label** (site pattern): `text-syn-accent text-xs font-semibold tracking-[0.15em] uppercase`, optionally
  with a 13px icon.
- Section label inside a card: `text-syn-muted text-[11px] font-semibold tracking-wider uppercase`.
- Prices: `text-4xl font-bold tracking-tight tabular-nums`. Always use `tabular-nums` for numbers that change.
- Codes and IDs: `font-mono text-xs text-syn-muted`.

## Components

| Element | Classes |
|---|---|
| Primary CTA | `rounded-lg bg-syn-accent text-syn-on-accent px-4 py-3 text-sm font-semibold hover:brightness-95 disabled:opacity-60 transition` |
| Secondary button (none in the UI yet; use this pattern) | `rounded-lg border border-syn-border-bright text-syn-text px-4 py-3 text-sm font-semibold hover:bg-syn-card-hover` (site: transparent, 1px light border, white text) |
| Success state | `rounded-xl border border-syn-success/40 bg-syn-success/10 text-syn-success` |
| Card | `bg-syn-card border border-syn-border rounded-xl p-6` |
| Panel inside a card | `bg-syn-surface border border-syn-border rounded-xl p-5` |
| Pill / badge | `text-[11px] font-semibold text-syn-secondary bg-syn-surface border border-syn-border px-2.5 py-1 rounded-full` |
| Segmented control | container `bg-syn-card border border-syn-border rounded-lg p-1`; active item `bg-syn-accent text-syn-on-accent rounded-md`; inactive `text-syn-secondary hover:text-white` |
| Switch | track `on ? 'bg-syn-accent' : 'bg-syn-border-bright'`; knob `on ? 'bg-syn-primary' : 'bg-white'` |
| Number input | `bg-syn-card border border-syn-border rounded-lg text-syn-text focus:outline-none focus:border-syn-accent` (focus must reach 3:1; `syn-border-bright` is only 1.9:1 on a card) |
| Range slider | `accent-[#FBF321]` |
| Top bar | `sticky top-0 z-50 glass keyline-bottom border-x-0 border-t-0` |
| Error text | `text-xs text-syn-danger` |

Shapes: buttons `rounded-lg` (8px, as on the site), cards and panels `rounded-xl` (12px), pills `rounded-full`. Shadows are
avoided, as on the site. On hover, change the border or background rather than adding a glow (`.card-glow` gives a faint
yellow outline).

## Branding and assets

- The logo is text only: "SYNECHRON" (`font-semibold tracking-wider`) with "SALES COPILOT" as a yellow eyebrow under it.
- **Don't copy logos, the brand "O" device or images from synechron.com into this public repository** without
  approval. Don't build look-alike monograms either.
- Never use client names or data in examples, mocks or screenshots. Use fictional products only.

## Contrast (WCAG 2.x, already checked)

| Pair | Ratio |
|---|---|
| `#FFFFFF` on `#021922` (card) | 18.0 : 1 |
| `#B2B4B4` on `#021922` | 8.7 : 1 |
| `#8F9292` on `#021922` / `#002535` / `#000E15` | 5.8 / 5.1 / 6.2 : 1 |
| `#002535` on `#FBF321` (CTA) | 13.6 : 1 |
| `#FBF321` on `#002535` (eyebrow) | 13.6 : 1 |
| `#A2E363` on `#021922` | 11.8 : 1 |
| `#FF8A80` on `#021922` | 7.9 : 1 |
| `#8F9292` on `#0A5A78` (bright gradient corner) | **2.4 : 1, fails, see rule 4** |
| `#FBF321` focus border on `#021922` | 15.4 : 1 |
| `#35474E` (`syn-border-bright`) on `#021922` | **1.9 : 1, decorative only, never a focus indicator** |

When you introduce a new text/background pair, check it reaches 4.5:1, or 3:1 for large text (24px and above,
or about 18.7px bold). Focus indicators and other meaningful non-text UI need 3:1 against their background.

## Motion

The current motion: page fade-and-rise, the spring on the segmented-control pill (`layoutId`), and a price colour flash
(yellow to white, from `BRAND`). If you add more, match the site: about 12px rise, about 320ms, and the site's
easing `cubic-bezier(0.83, -0.01, 0.13, 1)` (its `--ease` variable). Animate only
`transform` and `opacity`. Keep it short and calm, and don't animate the background.

## Workflow and checks

1. Install with `npm install --legacy-peer-deps`. Plain `npm install` fails on a React 19 peer from the UI Bundle plugin.
2. **Restart `npm run dev` after any change to `tailwind.config.js`.** Otherwise it serves a stale mix of old and new
   colours.
3. `npm run build` (`tsc` + vite) must pass. It writes `dist/` into the UI Bundle, and `dist/` is committed.
4. Outside Salesforce, `npm run dev` has no data. To preview with data, serve `npm run preview` and intercept the
   requests in a test browser (e.g. Playwright `page.route`), with fictional data only:
   - `POST /services/data/v66.0/graphql` must return the raw GraphQL shape that `fetchSFRequestOffer` maps, not a
     `RequestOffer`. It looks like `{ data: { uiapi: { query: { SalesCopilot_Request__c, Product2,
     PricebookEntry, ProductRelatedComponent, PriceAdjustmentTier } } } }`, each as `{ edges: [{ node }] }`, with
     fields as in `requestOfferQuery` in `src/lib/sfGraphQL.ts`.
   - The "Create quote" button calls `POST /services/apexrest/salescopilot/quote`. Return
     `{ status: "created", quoteId, quoteUrl, grandTotal }`.
5. Deploy with `SF_ORG=<alias> npm run deploy`, then check in the org that the font loads from `assets/` and the console
   shows no CSP errors.
6. Grep the files you touched: `grep -nE "#[0-9A-Fa-f]{6}|orange-|purple-|red-400" <files>` should find nothing
   beyond the exceptions in rule 1.

## Known legacy (catalog mode)

The request page (`?requestId=`, `RequestPage.tsx`) is fully on the tokens. The older catalog mode (no `requestId`)
only had its orange/purple CTA gradients replaced. It still uses raw Tailwind colours (`text-*-400`, `bg-*-400/10`)
in `BundleComponents`, `CartItemRow`, `LiveStatusBar` (`emerald-*`), `OfferPage`, `PriceDisplay`, `ProductCard`,
`ProductCarousel` and `ProductDetailDrawer`, plus category accent hex values and `from-*-900` gradients in
`src/lib/sfGraphQL.ts`. They
are readable on the dark theme but off-palette. When you touch one of those files, move what you touch to tokens:
success to `syn-success`, warnings and highlights to `syn-accent`, info to `syn-purple` (secondary blue), errors to
`syn-danger`.
