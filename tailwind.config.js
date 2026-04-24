/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      colors: {
        cream: {
          50: '#faf7f2',
          100: '#f5f0e8',
          200: '#ebe3d4'
        },
        forest: {
          600: '#2a5a4d',
          700: '#1f4a3f',
          800: '#1a3a32',
          900: '#122821'
        },
        clay: {
          400: '#e08a5c',
          500: '#d97748',
          600: '#c25d2e'
        }
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgb(26 58 50 / 0.08), 0 1px 3px -1px rgb(26 58 50 / 0.06)',
        glow: '0 0 0 4px rgb(217 119 72 / 0.15)'
      }
    }
  },
  plugins: []
}
