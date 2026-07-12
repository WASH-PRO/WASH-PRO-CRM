/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        panel: {
          sidebar: '#0b0f14',
          'sidebar-hover': '#151b24',
          'sidebar-border': '#1e2733',
          canvas: '#f3f5f8',
          'canvas-dark': '#080a0d',
          card: '#ffffff',
          'card-dark': '#11161d',
          border: '#e4e8ef',
          'border-dark': '#1e2733',
          muted: '#64748b',
          'muted-dark': '#94a3b8',
          ink: '#0f172a',
          'ink-dark': '#f1f5f9',
          surface: '#ffffff',
          'surface-dark': '#11161d',
          bg: '#f8fafc',
          'bg-dark': '#0b0f14',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
        'panel-lg': '0 4px 6px rgba(15, 23, 42, 0.04), 0 20px 48px rgba(15, 23, 42, 0.08)',
        'panel-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        glow: '0 0 0 1px rgba(6, 182, 212, 0.15), 0 8px 32px rgba(6, 182, 212, 0.12)',
      },
      borderRadius: {
        panel: '14px',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
