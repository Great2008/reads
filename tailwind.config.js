/** @type {import('tailwindcss').Config} */
export default {
  // CRITICAL: Tells Tailwind which files to scan for utility classes
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Allows the use of the 'dark:' prefix (e.g., dark:bg-slate-800)
  darkMode: 'class', 
  theme: {
    extend: {
      // You can define custom colors here if needed, but the default classes will work.
    },
  },
  plugins: [],
}
