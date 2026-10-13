import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from a subfolder (/Systems-in-Motion/ or
// /Systems-in-Motion/pr-preview/pr-N/), so CI passes the folder in BASE_PATH.
// Locally it is '/'. Routes are hash-based, so only assets care about base (ADR 0008).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
