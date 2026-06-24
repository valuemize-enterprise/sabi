/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sabi: {
          bg:           '#0d0d1a',
          surface:      '#12122a',
          purple:       '#6d28d9',
          'purple-light':'#8b5cf6',
          'purple-dark': '#4c1d95',
          success:      '#10b981',
          warning:      '#f59e0b',
          danger:       '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up':   'slideUp 0.4s ease forwards',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 20px rgba(109,40,217,0.3)' }, '50%': { boxShadow: '0 0 40px rgba(109,40,217,0.6)' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      backgroundImage: {
        'sabi-gradient':     'linear-gradient(135deg, #6d28d9, #8b5cf6)',
        'sabi-gradient-dark':'linear-gradient(135deg, #4c1d95, #6d28d9)',
        'sabi-radial':       'radial-gradient(ellipse at top, #1a0a3a, #0d0d1a)',
      },
    },
  },
  plugins: [],
};
