import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // GitHub Pages liefert die Seite unter /Doppelkopf/ aus.
  base: process.env.GITHUB_PAGES ? '/Doppelkopf/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./supabase/functions/_shared/engine/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
