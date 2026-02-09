/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        xxxs: ['0.5rem', { lineHeight: '0.75rem' }], // 8px
        xxs: ['0.625rem', { lineHeight: '1rem' }], // 10px
      },
    },
  },
  plugins: [],
}
