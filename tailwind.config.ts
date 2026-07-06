import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      colors: {
        mars: {
          50: '#fff3ec',
          100: '#ffd7b8',
          200: '#ffb27c',
          300: '#ff8a4d',
          400: '#e9652a',
          500: '#b8431b',
          600: '#8a2d14',
          700: '#5a1d0c',
          800: '#2f0f06',
          900: '#180804',
        },
      },
    },
  },
  plugins: [],
};

export default config;
