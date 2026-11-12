/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: '#F5F6F4',
        surface: '#FFFFFF',
        border: '#E4E6E1',
        sidebar: '#111418',
        'sidebar-hover': '#1C2128',
        'sidebar-active': '#262D36',
        'sidebar-border': '#2A3038',
        text: {
          primary: '#14171A',
          secondary: '#5B6169',
          muted: '#8C929A',
        },
        accent: {
          DEFAULT: '#0F9D7A',
          light: '#E6F5F1',
          dark: '#0A7A5F',
        },
        danger: {
          DEFAULT: '#D92D20',
          light: '#FEF2F0',
          dark: '#B02015',
        },
        warning: {
          DEFAULT: '#E8A317',
          light: '#FEF8EC',
          dark: '#B87D0E',
        },
        info: {
          DEFAULT: '#2563EB',
          light: '#EFF6FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12px', '18px'],
        base: ['14px', '20px'],
        md: ['14px', '20px'],
        lg: ['16px', '24px'],
        xl: ['18px', '28px'],
        '2xl': ['20px', '28px'],
        '3xl': ['24px', '32px'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      spacing: {
        px: '1px',
        0.5: '2px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
    },
  },
  plugins: [],
}
