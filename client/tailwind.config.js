/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        surface: {
          DEFAULT: '#0e1422',
          elevated: '#131b2e',
          subtle: '#182238',
          light: '#ffffff',
          'light-subtle': '#f8fafc',
          dark: '#0e1422',
          'dark-elevated': '#131b2e',
          'dark-subtle': '#182238',
          'dark-border': 'rgba(255, 255, 255, 0.08)',
        },
        slate: {
          850: '#111827',
          900: '#0c121e',
          925: '#080d17',
          950: '#060910',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'card-dark': '0 4px 24px -2px rgba(0, 0, 0, 0.5), 0 1px 3px 0 rgba(255, 255, 255, 0.02)',
        'fintech': '0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'fintech-md': '0 6px 20px -3px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'fintech-lg': '0 16px 36px -4px rgba(0, 0, 0, 0.08), 0 4px 14px -2px rgba(0, 0, 0, 0.04)',
        'glow-emerald': '0 0 28px -4px rgba(16, 185, 129, 0.22)',
        'glow-rose': '0 0 28px -4px rgba(244, 63, 94, 0.22)',
      }
    },
  },
  plugins: [],
}
