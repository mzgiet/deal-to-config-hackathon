/** @type {import('tailwindcss').Config} */
// Synechron brand palette. Sources (see _internal/plan_synechron_ui_restyle.md):
// synechron.com computed styles + the official brand book (core blue #002535,
// secondary gradient blue #0A5A78, yellow #FBF321 used sparingly).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        syn: {
          bg: '#002535', // brand core blue, base of the page gradient
          surface: '#000E15', // darkest site background (footer/hero), inner panels
          card: '#021922', // site hero background
          'card-hover': '#042430', // lighter end of the site's dark-card gradient
          border: '#142931', // rgba(255,255,255,.07) over card
          'border-bright': '#35474E', // rgba(255,255,255,.2) over card
          orange: '#FBF321', // legacy name, now the brand yellow accent
          'orange-hover': '#FBF321',
          purple: '#0A5A78', // legacy name, now the brand secondary blue
          'purple-hover': '#023D53',
          text: '#FFFFFF',
          secondary: '#B2B4B4',
          muted: '#8F9292', // site #808282 lightened to pass AA on #002535
          success: '#A2E363',
          blue: '#0A5A78',
          // New semantic tokens
          primary: '#002535',
          accent: '#FBF321',
          'on-accent': '#002535',
          danger: '#FF8A80', // no brand error colour exists; AA on dark cards
        },
      },
      fontFamily: {
        sans: ['"Montserrat Variable"', 'Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        // Brand master gradient: core blue dominant (>= 60%), secondary blue as the transition.
        'syn-gradient': 'linear-gradient(90deg, #002535 60%, #0A5A78)',
        'syn-gradient-subtle': 'linear-gradient(90deg, rgba(10,90,120,0.45), rgba(10,90,120,0))',
        'syn-gradient-card': 'linear-gradient(135deg, #042430, #000E15)',
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
          '30%': { transform: 'scale(1.08)', color: '#FBF321' },
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
