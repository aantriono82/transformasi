/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './script.js', './transformations.js'],
  theme: {
    extend: {
      screens: { xs: '475px', '3xl': '1920px' },
      colors: {
        primary: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a'
        },
        secondary: { 500: '#f59e0b', 600: '#d97706' }
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
      fontSize: { xxs: '0.625rem' }
    }
  }
};
