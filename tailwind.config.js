/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'monad-purple': '#836EF9',
        'monad-blue': '#200052',
        'monad-berry': '#A0055D',
        'monad-off-white': '#FBFAF9',
        'monad-black': '#0E100F',
      },
      fontFamily: {
        'arcade': ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
