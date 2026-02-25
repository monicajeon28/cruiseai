import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'xs': '0.875rem',      // 14px
        'sm': '1rem',          // 16px
        'base': '1.125rem',    // 18px ⭐ 기본 크기 상향
        'lg': '1.25rem',       // 20px
        'xl': '1.5rem',        // 24px
        '2xl': '1.75rem',      // 28px
        '3xl': '2rem',         // 32px
        '4xl': '2.5rem',       // 40px
        '5xl': '3rem',         // 48px
      },
      colors: {
        'brand-red': '#E50914',
        'brand-dark': '#141414',
        'brand-light-dark': '#2F2F2F',
        'brand-neutral': '#F5F5F1',
        'magic-gold': '#FFD700',
        'banana-gold': '#D4AF37',
        'banana-cream': '#F9F7F2',
        'ocean-deep': '#051C2C',
        'text': {
          'primary': '#111827',
          'secondary': '#374151',
          'tertiary': '#6B7280',
        },
        'surface': {
          'primary': '#FFFFFF',
          'secondary': '#F9F7F2',
          'tertiary': '#F3F4F6',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
