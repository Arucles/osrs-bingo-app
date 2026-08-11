/** @type {import('tailwindcss').Config} */

// El color de acento sale de variables CSS que App.jsx cambia segun el equipo
// activo. Usamos triples RGB sueltos para que Tailwind siga soportando los
// modificadores de opacidad (ej: bg-accent-500/10).
const accent = (shade) => `rgb(var(--accent-${shade}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          200: accent(200),
          300: accent(300),
          400: accent(400),
          500: accent(500),
          600: accent(600),
          950: accent(950),
        },
      },
    },
  },
  plugins: [],
};
