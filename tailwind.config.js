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
        'primary': 'var(--text-primary)',
        'muted': 'var(--text-secondary)',
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'card': 'var(--card-bg)',
        'border-theme': 'var(--border-color)',
        'hover-theme': 'var(--hover-bg)',
        'accent-color': 'var(--accent-color)',
        
        // backwards compat mappings
        'h-bg': 'var(--h-bg)',
        'h-sec': 'var(--h-sec)',
        'h-card': 'var(--h-card)',
        'h-primary': 'var(--h-primary)',
        'h-secondary': 'var(--h-secondary)',
        'h-border': 'var(--h-border)',
      }
    },
  },
  plugins: [],
}

