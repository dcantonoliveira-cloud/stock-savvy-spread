import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Rondello Buffet — azul marinho escuro
        ron: {
          50:  '#EDF0F8',
          100: '#C8D0EA',
          200: '#9AAAD4',
          800: '#253775',
          900: '#1B2A5C',
          950: '#0F1830',
          DEFAULT: '#1B2A5C',
        },
        // Rondello Buffet — dourado
        gold: {
          50:  '#FBF6E8',
          100: '#F3E8C8',
          200: '#E8CC88',
          300: '#D4AB52',
          400: '#C4973A',
          500: '#C4973A',
          600: '#9A7220',
          800: '#6B4E10',
          DEFAULT: '#C4973A',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
