import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#285C48', foreground: '#FFFFFF', dark: '#1F4A3A' },
        secondary: { DEFAULT: '#F5F5EF', foreground: '#233E34' },
        surface: '#FCFCF8',
        ink: '#233E34',
        muted: { DEFAULT: '#F0F2E9', foreground: '#738078' },
        line: '#E2E6DD',
        tint: '#E8EEE3',
      },
      fontFamily: { sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'] },
      borderRadius: { lg: '12px', md: '10px', sm: '8px' },
    },
  },
  plugins: [],
};
export default config;
