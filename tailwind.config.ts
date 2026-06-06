import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        'ink-4': 'var(--ink-4)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        teal: {
          50: '#f0fdfa', 100: '#ccfbf1', 300: '#5eead4', 400: '#2dd4bf',
          500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
          tint: 'var(--teal-tint)',
        },
        amber: { DEFAULT: '#d97706', bg: 'var(--amber-bg)', tint: 'var(--amber-tint)' },
        green: { DEFAULT: '#16a34a', bg: 'var(--green-bg)', tint: 'var(--green-tint)' },
        red:   { DEFAULT: '#dc2626', bg: 'var(--red-bg)',   tint: 'var(--red-tint)' },
        sky:   { DEFAULT: '#0284c7', bg: 'var(--sky-bg)' },
        violet:{ DEFAULT: '#7c3aed', bg: 'var(--violet-bg)' },
      },
      borderRadius: { sm: '8px', DEFAULT: '12px', lg: '16px', xl: '22px' },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      keyframes: {
        fade: { from: { transform: 'translateY(6px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        pulseRing: { '70%': { boxShadow: '0 0 0 7px rgba(22,163,74,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(22,163,74,0)' } },
        skel: { '0%': { backgroundPosition: '100% 0' }, '100%': { backgroundPosition: '-100% 0' } },
      },
      animation: {
        fade: 'fade .25s ease both',
        pulseRing: 'pulseRing 1.8s infinite',
        skel: 'skel 1.4s ease infinite',
      },
    },
  },
  plugins: [],
};
export default config;
