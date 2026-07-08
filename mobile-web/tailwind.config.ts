import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Rondello Buffet — azul royal vibrante
        ron: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          700: '#3730A3',
          800: '#1D4ED8',   // azul vivo para botões e elementos interativos
          900: '#1E3A8A',   // azul escuro mas claramente azul (não preto)
          950: '#172554',   // fundo de hero — escuro sem parecer preto puro
          DEFAULT: '#1E3A8A',
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
