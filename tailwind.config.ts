import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // ZeroFox brand colors
        aravo: {
          red: '#FF4B4B',
          orange: '#FF6B35',
          yellow: '#FFB347',
          gold: '#FFD700',
        },
        confidence: {
          high: '#28A745',
          medium: '#FFB347',
          low: '#DC3545',
        }
      },
      backgroundImage: {
        'aravo-gradient': 'linear-gradient(135deg, #FF4B4B 0%, #FFB347 100%)',
        'aravo-subtle': 'linear-gradient(135deg, #FFF5F5 0%, #FFFBF0 100%)',
        'aravo-accent': 'linear-gradient(90deg, #FF6B35 0%, #FFD700 100%)',
      }
    },
  },
  plugins: [],
};
export default config;
