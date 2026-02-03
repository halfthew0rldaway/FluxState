import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    // Static output for GitHub Pages
    output: 'static',
    // Build settings
    build: {
        format: 'file'
    },
    // Disable TypeScript checking
    typescript: {
        strict: false
    }
});
