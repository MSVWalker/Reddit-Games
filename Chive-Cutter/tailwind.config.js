/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/client/**/*.{html,js,ts,jsx,tsx}",
        "./src/client/*.html",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#2ecc71',
                danger: '#e74c3c',
            },
        },
    },
    plugins: [],
}
