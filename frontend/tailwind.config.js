/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette Obsidienne (Violets profonds et électriques)
        obsidian: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6', // Primary accent
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Palette Sombre (Noirs teintés de violet/bleu nuit)
        dark: {
          50: '#f8f8fc',
          100: '#f1f1f6',
          200: '#e4e4eb',
          300: '#d1d1db',
          400: '#9d9db0',
          500: '#75758a',
          600: '#555569',
          700: '#3a3a48',
          800: '#22222c',
          900: '#14141a',
          950: '#09090c',
        },
        // Couleurs cristal pour les effets de verre
        crystal: {
          white: 'rgba(255, 255, 255, 0.08)',
          highlight: 'rgba(255, 255, 255, 0.12)',
          edge: 'rgba(255, 255, 255, 0.05)',
        }
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(139, 92, 246, 0.5)',
        'glow-lg': '0 0 40px -5px rgba(139, 92, 246, 0.6)',
        'glow-sm': '0 0 15px -3px rgba(139, 92, 246, 0.4)',
        'glow-intense': '0 0 60px -10px rgba(139, 92, 246, 0.8)',
        'inner-glow': 'inset 0 0 30px -10px rgba(139, 92, 246, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'glass-hover': '0 12px 40px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
        'crystal': '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(139, 92, 246, 0.05)',
        'crystal-lg': '0 8px 50px rgba(0, 0, 0, 0.4), inset 0 0 30px rgba(139, 92, 246, 0.08)',
        'edge-light': 'inset 1px 1px 0 rgba(255, 255, 255, 0.1), inset -1px -1px 0 rgba(0, 0, 0, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'obsidian-gradient': 'linear-gradient(to bottom right, var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 100%)',
        'crystal-shine': 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
        'crystal-edge': 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 30%)',
        'obsidian-surface': 'linear-gradient(180deg, rgba(139,92,246,0.03) 0%, transparent 50%)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgba(139, 92, 246, 0.4)' },
          '50%': { boxShadow: '0 0 30px -5px rgba(139, 92, 246, 0.6)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
