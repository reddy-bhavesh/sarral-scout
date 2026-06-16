/*
 * Central color source of truth for the Scout app.
 *
 * Brand palette (https://coolors.co):
 *   red   #e63946   cream #f1faee   cyan #a8dadc   blue #457b9d   navy #1d3557
 *
 * Two consumers import from here so there is a single place to change colors:
 *   1. tailwind.config.js  — maps these ramps onto the built-in color scales,
 *      which is what every `bg-*`/`text-*`/`border-*` utility class resolves to.
 *   2. App code (canvas, charts, inline styles) — JS/TS contexts where Tailwind
 *      utilities don't apply and a literal color value is required.
 */

// Raw brand colors, for direct/named use.
export const brand = {
  red: '#e63946',
  cream: '#f1faee',
  cyan: '#a8dadc',
  blue: '#457b9d',
  navy: '#1d3557',
} as const;

// Neutral ramp: cool near-white (light) -> navy (dark). Drives gray/slate/zinc/
// neutral. NB: the brand cream #f1faee is honeydew (green-dominant) and reads
// sickly green as a full-page background, so the light end is a clean cool
// near-white that matches the rest of the (cool) ramp; cream is kept as a
// named token (brand.cream) for small accents instead.
export const neutral = {
  50: '#f5f8fb', // cool near-white
  100: '#eaf0f3',
  200: '#d3dfe6',
  300: '#b0c2cf',
  400: '#7e95a6',
  500: '#5a7287',
  600: '#45596d',
  700: '#344455',
  800: '#253544',
  900: '#1d3557', // brand navy
  950: '#142639',
} as const;

// Cool accent ramp anchored on brand blue, with the brand cyan as 200.
export const accentBlue = {
  50: '#eef6f8',
  100: '#d7e9ed',
  200: '#a8dadc', // brand cyan
  300: '#82c2c8',
  400: '#5ba0b3',
  500: '#457b9d', // brand blue
  600: '#3a6786',
  700: '#305570',
  800: '#294861',
  900: '#1d3557', // brand navy
  950: '#142640',
} as const;

// Gradient-partner ramp (indigo/purple/violet): deeper, navy-leaning so that
// `from-blue-500 to-purple-600` style gradients read as teal -> navy.
export const accentDeep = {
  50: '#ecf0f5',
  100: '#d5dded',
  200: '#b0bcd6',
  300: '#8497bd',
  400: '#5a6f9c',
  500: '#3d5380',
  600: '#314368',
  700: '#283656',
  800: '#1f2b46',
  900: '#1d3557', // brand navy
  950: '#131f33',
} as const;

// Danger ramp anchored on the brand red. Drives red/rose.
export const danger = {
  50: '#fdebec',
  100: '#fad1d4',
  200: '#f4a7ac',
  300: '#ee7b82',
  400: '#ea5a63',
  500: '#e63946', // brand red
  600: '#cf2734',
  700: '#ad1f29',
  800: '#8b1921',
  900: '#6f141b',
  950: '#420a0e',
} as const;

// ---------------------------------------------------------------------------
// JS-context colors — used where Tailwind utility classes can't reach.
// ---------------------------------------------------------------------------

// Animated network/constellation canvas (components/NetworkGrid.tsx).
export const network = {
  node: 'rgba(69, 123, 157, 0.8)', // brand blue #457b9d
  nodeHover: 'rgba(168, 218, 220, 0.95)', // brand cyan #a8dadc
  line: 'rgba(69, 123, 157, 0.15)',
  lineActive: 'rgba(168, 218, 220, 0.4)',
  glowInner: 'rgba(168, 218, 220, 0.3)',
  glowOuter: 'rgba(168, 218, 220, 0)',
} as const;

// Recharts data visualisations (pages/BreachChecker.tsx). Status hues
// (orange/green/amber) are intentionally kept for legibility.
export const chart = {
  // Password strength: plaintext / easy-to-crack / strong / unknown.
  password: [brand.red, '#f97316', '#22c55e', neutral[500]],
  // Categorical industry breakdown.
  industry: [brand.blue, brand.red, brand.cyan, brand.navy, '#f59e0b', accentBlue[300]],
  tooltipBg: neutral[800],
  tooltipBorder: neutral[700],
  tooltipText: '#ffffff',
  grid: neutral[700],
  axis: neutral[500],
  axisTick: neutral[400],
  // Trend area / line (yearly breach volume).
  area: brand.red,
} as const;

// Status colors for inline SVG charts (pages/Dashboard.tsx). Success keeps its
// own green hue since the brand palette has no equivalent.
export const status = {
  info: brand.blue, // total / informational series
  success: '#10b981', // completed
  danger: brand.red, // failed
} as const;

// Vulnerability severity colors, shared by Dashboard and ScanDetails charts.
// Critical/Low use brand hues; High/Medium keep their semantic orange/yellow.
export const severity = {
  critical: brand.red,
  high: '#f97316',
  medium: '#eab308',
  low: brand.blue,
} as const;

// framer-motion inline effects on the landing page (glows, hover borders).
export const effect = {
  glowBlue: 'rgba(69, 123, 157, 0.4)', // brand blue #457b9d
  glowRed: 'rgba(230, 57, 70, 0.4)', // brand red #e63946 — CTA hover glow
  borderHover: 'rgb(91, 160, 179)', // accentBlue 400 #5ba0b3 (cyan-leaning)
  shadow: 'rgba(0, 0, 0, 0.3)',
} as const;

// Microsoft logo squares (pages/Login.tsx SSO button). These are Microsoft's
// trademarked brand colors and must NOT be re-themed — centralized only so no
// color literal lives outside this file.
export const microsoft = {
  red: '#f25022',
  green: '#7fba00',
  blue: '#00a4ef',
  yellow: '#ffb900',
} as const;

// Deep page background used on the marketing/auth shells in dark mode.
export const surfaceDeep = neutral[950];

// Global scrollbar gradient (index.css). Exposed to CSS via custom properties
// injected by applyCssVars() below, so CSS has no color literals of its own.
export const scrollbar = {
  from: brand.blue,
  to: brand.navy,
  hoverFrom: accentBlue[600],
  hoverTo: accentBlue[950],
  thumb: brand.blue,
} as const;

// Brand gradient used for clip-text headings (.text-gradient-brand in
// index.css). Needs to stay legible on BOTH backgrounds, so it has a dark-blue
// variant for the cream light theme and a light-cyan variant for the navy dark
// theme. All cool/brand hues — no purple or magenta.
export const textGradient = {
  light: [accentBlue[500], accentBlue[700], brand.navy], // dark blues on cream
  dark: [brand.cyan, accentBlue[300], accentBlue[400]], // light cyans on navy
} as const;

/**
 * Publish palette values that CSS needs as `:root` custom properties. CSS can't
 * import this module, so call this once at app startup (see main.tsx) to keep
 * palette.ts the single source of truth even for stylesheet colors.
 */
export function applyCssVars(root: HTMLElement = document.documentElement) {
  root.style.setProperty('--scrollbar-from', scrollbar.from);
  root.style.setProperty('--scrollbar-to', scrollbar.to);
  root.style.setProperty('--scrollbar-hover-from', scrollbar.hoverFrom);
  root.style.setProperty('--scrollbar-hover-to', scrollbar.hoverTo);
  root.style.setProperty('--scrollbar-thumb', scrollbar.thumb);

  const grad = (stops: readonly string[]) => `linear-gradient(to right, ${stops.join(', ')})`;
  root.style.setProperty('--text-gradient-brand-light', grad(textGradient.light));
  root.style.setProperty('--text-gradient-brand-dark', grad(textGradient.dark));

  // Light-mode dot-grid texture color: faint navy dots.
  root.style.setProperty('--dot-grid', 'rgba(29, 53, 87, 0.07)');
}
