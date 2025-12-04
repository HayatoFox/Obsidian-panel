/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          50: '#f4f3f8',
          100: '#e9e7f1',
          200: '#d3cfe3',
          300: '#b8b0cf',
          400: '#9a8db7',
          500: '#8172a4',
          600: '#6f5f91',
          700: '#5c4e77',
          800: '#4d4263',
          900: '#413952',
          950: '#2a2535',
        },
        dark: {
          50: '#f6f6f7',
          100: '#e2e3e5',
          200: '#c5c6ca',
          300: '#a0a2a8',
          400: '#7b7e85',
          500: '#61646b',
          600: '#4c4f55',
          700: '#3e4046',
          800: '#35373b',
          900: '#1e1f22',
          950: '#131416',
        }
      },
    },
  },
  plugins: [],
}
