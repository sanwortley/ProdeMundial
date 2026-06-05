/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        soccer: {
          dark: '#0b0f19',      // Deep pitch night
          card: '#161c2c',      // Dark slate card
          green: '#10b981',     // Pitch green emerald
          lightgreen: '#34d399', // Hover green
          gold: '#fbbf24',      // Trophy gold
          silver: '#94a3b8',    // Second place silver
          bronze: '#d97706',    // Third place bronze
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
