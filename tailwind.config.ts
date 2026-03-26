import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nhs: {
          blue:       '#005EB8',
          'dark-blue':'#003087',
          green:      '#007F3B',
          'light-blue':'#41B6E6',
          yellow:     '#FFB81C',
          red:        '#DA291C',
          'pale-grey':'#F0F4F5',
          'mid-grey': '#AEB7BD',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
