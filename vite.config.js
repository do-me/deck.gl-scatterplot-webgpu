import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    // Set the base path to the repository name for GitHub Pages deployment
    base: process.env.NODE_ENV === 'production' ? '/deck.gl-scatterplot-webgpu/' : '/',
});
