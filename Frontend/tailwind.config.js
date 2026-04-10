/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        bio: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        risk: {
          high:   '#ef4444',
          medium: '#3b82f6',
          low:    '#22c55e',
        },
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 6px 1px rgba(34,197,94,0.35)' },
          '50%':       { boxShadow: '0 0 18px 4px rgba(34,197,94,0.7)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        'scan-line':  'scan-line 3s linear infinite',
      },
    },
  },
  plugins: [],
};
