/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./**/*.{html,js,ts,jsx,tsx}",
        "./*.html",
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
