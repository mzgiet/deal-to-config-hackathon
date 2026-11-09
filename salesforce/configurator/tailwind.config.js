/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        syn: {
          bg: '#07090F',
          surface: '#0E1219',
          card: '#141826',
          'card-hover': '#1C2236',
          border: '#1F2845',
          'border-bright': '#2D3D6B',
          orange: '#FF5733',
          'orange-hover': '#FF6B4A',
          purple: '#8B3DFF',
          'purple-hover': '#9C52FF',
          text: '#FFFFFF',
          secondary: '#94A0BC',
          muted: '#4D5A7A',
          success: '#22C55E',
          blue: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'syn-gradient': 'linear-gradient(135deg, #FF5733, #8B3DFF)',
        'syn-gradient-subtle': 'linear-gradient(135deg, rgba(255,87,51,0.12), rgba(139,61,255,0.12))',
        'syn-gradient-card': 'linear-gradient(135deg, rgba(255,87,51,0.06), rgba(139,61,255,0.06))',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.4s ease',
        'price-flash': 'priceFlash 0.5s ease',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        priceFlash: {
          '0%': { transform: 'scale(1)', color: '#FFFFFF' },
          '30%': { transform: 'scale(1.08)', color: '#FF5733' },
          '100%': { transform: 'scale(1)', color: '#FFFFFF' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
