/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nhs: {
          blue: '#005EB8',
          darkblue: '#003087',
          lightblue: '#41B6E6',
          green: '#009639',
          red: '#DA291C',
          yellow: '#FFB81C',
          white: '#FFFFFF',
          grey: '#425563',
          lightgrey: '#E8EDEE',
        }
      }
    },
  },
  plugins: [],
}
