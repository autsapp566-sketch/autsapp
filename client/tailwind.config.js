/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
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
    },
  },
  plugins: [],
};
