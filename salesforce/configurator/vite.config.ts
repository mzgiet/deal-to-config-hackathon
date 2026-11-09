import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import salesforce from '@salesforce/vite-plugin-ui-bundle';

export default defineConfig({
  base: './',
  plugins: [react(), salesforce()],
  build: {
    outDir: '../force-app/main/default/uiBundles/RevenueConfigurator/dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
});
