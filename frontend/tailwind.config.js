/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === NSS / Editorial FIFA WC26 Palette ===
        soccer: {
          // Legacy compatibility
          dark:       '#0d0d0d',
          card:       '#1a1a1a',
          green:      '#00a651',   // Verde FIFA
          lightgreen: '#00c060',
          gold:       '#f5a623',
          silver:     '#9b9b9b',
          bronze:     '#c77b30',
        },
        wc: {
          black:   '#0d0d0d',   // Casi negro — fondo editorial
          dark:    '#141414',   // Card background
          mid:     '#1f1f1f',   // Elevated card
          border:  '#2a2a2a',   // Borde sutil
          muted:   '#6b6b6b',   // Texto secundario
          white:   '#f5f5f5',   // Blanco cálido
          // Colores mundialistas vivos
          green:   '#00a651',   // Verde FIFA cancha
          celeste: '#5bbce4',   // Celeste Argentina
          red:     '#e8192c',   // Rojo mundial
          gold:    '#f5a623',   // Dorado trofeo
          blue:    '#003f8a',   // Azul profundo
        }
      },
      fontFamily: {
        sans:    ['Outfit', 'sans-serif'],
        display: ['"Bebas Neue"', 'Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
