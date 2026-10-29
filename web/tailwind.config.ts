import type { Config } from 'tailwindcss';

// ECOM JOIN: navy surfaces, cyan + orange from the mark. Mirrored in client/tailwind.config.js.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plex-arabic)', 'IBM Plex Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ecfeff',
          100: '#cffafe',
          500: '#2ED4DE',
          600: '#14b8c7',
          700: '#0e8f9c',
          900: '#0B1C33',
        },
        ember: {
          400: '#FF8A3D',
          500: '#F26B1D',
          600: '#D8560F',
          700: '#B4430C',
        },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-up': 'fade-up 0.6s ease-out both' },
    },
  },
  plugins: [],
};

export default config;
