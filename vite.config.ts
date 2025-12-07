import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from 'rollup-plugin-visualizer';
import prerender from 'vite-plugin-prerender';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'production' && visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    // Pre-render marketing pages for SEO (generates static HTML at build time)
    mode === 'production' && prerender({
      staticDir: path.resolve(__dirname, 'dist'),
      routes: ['/', '/resources', '/pricing', '/features', '/demo', '/terms', '/privacy'],
      renderer: new prerender.PuppeteerRenderer({
        renderAfterTime: 3000,
        headless: true,
      }),
      postProcess(renderedRoute: { html: string; route: string }) {
        // Ensure proper doctype
        if (!renderedRoute.html.startsWith('<!DOCTYPE')) {
          renderedRoute.html = '<!DOCTYPE html>' + renderedRoute.html;
        }
        return renderedRoute;
      },
    }),
  ].filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        pure_funcs: mode === 'production' ? ['console.log', 'console.info'] : []
      },
      mangle: {
        safari10: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'chart-vendor': ['recharts'],
          'supabase-vendor': ['@supabase/supabase-js'],
        }
      }
    },
    // Increase chunk size warning limit for vendor chunks
    chunkSizeWarningLimit: 1000,
  }
}));
