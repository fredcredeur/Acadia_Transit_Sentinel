/** @type {import('tailwindcss').Config} */
export default {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
<<<<<<< HEAD
=======
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
>>>>>>> 3c24d9e62665244f95ff965ed5fc261ce073a64a
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
        },
      },
    },
  },
  plugins: [],
<<<<<<< HEAD
<<<<<<< HEAD
};
=======
}
>>>>>>> 3c24d9e62665244f95ff965ed5fc261ce073a64a
=======
};
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
