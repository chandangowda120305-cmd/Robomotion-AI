/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#0a0d12',
          900: '#0f141c',
          850: '#151b26',
          800: '#1b2331',
          750: '#232d3f',
          700: '#2c394f',
          600: '#3e4f6d',
          500: '#566d94',
          400: '#829bbd',
          300: '#b0c3dc',
          200: '#d7e2f1',
          100: '#edf2f9',
        },
        cyanAccent: {
          light: '#22d3ee',
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
          glow: 'rgba(6, 182, 212, 0.25)',
        },
        robotAmber: {
          light: '#fcd34d',
          DEFAULT: '#f59e0b',
          dark: '#b45309',
        },
        robotEmerald: {
          light: '#34d399',
          DEFAULT: '#10b981',
          dark: '#047857',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(6, 182, 212, 0.35)',
        'glow-amber': '0 0 15px rgba(245, 158, 11, 0.35)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.35)',
      }
    },
  },
  plugins: [],
}
