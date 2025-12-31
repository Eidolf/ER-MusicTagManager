/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#3b82f6',
                secondary: '#8b5cf6',
                dark: '#0f172a',
            }
        },
    },
    plugins: [],
}
