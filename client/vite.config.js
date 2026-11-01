import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Public origin used for canonical, Open Graph and JSON-LD URLs in index.html.
// Set SITE_URL in the build environment (Render already provides it).
const SITE_URL = (process.env.SITE_URL || 'https://tesoria.onrender.com').replace(/\/+$/, '');

// Replaces the __SITE_URL__ placeholder in index.html (dev server and build).
const siteUrlPlugin = () => ({
  name: 'tesoria-site-url',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
});

export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlPlugin()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
});
