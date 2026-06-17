/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta marki Imperial Design
        grafit: '#26261F', // tło główne
        panel: '#1C1C16', // ciemniejszy panel
        karta: '#32322A', // tło kart
        akcent: '#E3242B', // czerwień akcent
        krem: '#F2F0EA', // tekst kremowy
        przygaszony: '#BDBAB0', // tekst przygaszony
      },
      fontFamily: {
        // Nagłówki — szeryfowy
        naglowek: ['"Playfair Display"', 'serif'],
        // Tekst zwykły — sans-serif
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        karta: '0 4px 20px rgba(0, 0, 0, 0.35)',
      },
      borderRadius: {
        xl: '0.9rem',
      },
    },
  },
  plugins: [],
}
