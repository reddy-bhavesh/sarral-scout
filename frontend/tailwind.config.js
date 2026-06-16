/** @type {import('tailwindcss').Config} */

/*
 * Colors live in a single source of truth: src/theme/palette.ts.
 *
 * The app hardcodes Tailwind color utilities throughout instead of using
 * design tokens, so we re-theme by overriding the built-in color scales with
 * the palette ramps. Every existing class (bg-gray-900, text-blue-500,
 * from-blue-500 to-purple-600, etc.) automatically picks up the palette, and
 * dark/light mode keep working through the existing `darkMode: 'class'` setup:
 *   - light mode surfaces resolve to the cream end of the neutral ramp
 *   - dark mode surfaces resolve to the navy end
 */
import { brand, neutral, accentBlue, accentDeep, danger } from './src/theme/palette'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Direct, named access to the raw palette.
        brand,

        // Neutrals -> cream/navy ramp.
        gray: neutral,
        slate: neutral,
        zinc: neutral,
        neutral: neutral,

        // Cool accents -> brand blue/cyan ramp.
        blue: accentBlue,
        sky: accentBlue,
        cyan: accentBlue,

        // Gradient partners -> navy-leaning deep ramp. Pink/fuchsia are mapped
        // here too so `... to-pink-600` gradients read teal->navy, not magenta.
        indigo: accentDeep,
        purple: accentDeep,
        violet: accentDeep,
        pink: accentDeep,
        fuchsia: accentDeep,

        // Danger -> brand red ramp.
        red: danger,
        rose: danger,
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
