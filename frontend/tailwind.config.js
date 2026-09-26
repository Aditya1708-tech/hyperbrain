/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'theme-glow': 'var(--box-shadow-glow)',
      },
      colors: {
        // Semantic color tokens
        'background': 'var(--bg-primary)',
        'surface': 'var(--bg-secondary)',
        'surface-hover': 'var(--hover-bg)',
        'primary': 'var(--accent-color)',
        'primary-hover': 'var(--accent-hover)',
        'border': 'var(--border-color)',
        'border-hover': 'var(--border-hover)',
        'text': 'var(--text-primary)',
        'text-muted': 'var(--text-secondary)',
        'muted': 'var(--text-muted)',
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'error': 'var(--error)',
        'info': 'var(--info)',

        // Backwards compatibility mappings for older layouts
        'primary-text': 'var(--text-primary)',
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'card': 'var(--card-bg)',
        'border-theme': 'var(--border-color)',
        'hover-theme': 'var(--hover-bg)',
        'accent-color': 'var(--accent-color)',
        
        'h-bg': 'var(--h-bg)',
        'h-sec': 'var(--h-sec)',
        'h-card': 'var(--h-card)',
        'h-primary': 'var(--h-primary)',
        'h-secondary': 'var(--h-secondary)',
        'h-border': 'var(--h-border)',

        // Overriding default palettes to map to premium theme color system
        blue: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#00E5FF', // primary accent (cyan glow)
          600: '#2563EB', // secondary accent (blue gradient link)
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#04070D', // primary bg
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#8B5CF6', // support accent (purple)
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1', // text secondary
          400: '#94a3b8', // muted text
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#0A0F1C', // surface secondary
          900: '#04070D', // background primary
          950: '#020617',
        }
      }
    },
  },
  plugins: [],
}

