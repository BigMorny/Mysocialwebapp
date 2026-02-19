/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter-display)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: '#172554',
          100: '#1e3a8a',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      boxShadow: {
        soft: '0 16px 40px -20px rgba(2, 6, 23, 0.85)',
      },
    },
  },
  plugins: [],
};
