import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from 'rollup-plugin-visualizer';
import vitePrerender from 'vite-plugin-prerender';

// Marketing pages that need to be pre-rendered for SEO
const PRERENDER_ROUTES = [
  '/',
  '/pricing',
  '/features',
  '/features/brand-visibility',
  '/features/competitive-analysis',
  '/features/actionable-recommendations',
  '/features/citation-analysis',
  '/features/llms-txt',
  '/features/content-studio',
  '/features/tier-comparison',
  '/resources',
  '/demo',
  '/privacy',
  '/terms',
  '/security',
  '/sitemap',
  '/black-friday',
  '/agencies',
  '/vs-competitors',
  '/free-checker',
  '/plans/starter',
  '/plans/growth',
  '/plans/pro',
  '/blog/how-to-optimize-for-chatgpt-search',
  '/blog/profound-ai-alternative-pricing',
];

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
    // Pre-render marketing pages for SEO (generates static HTML)
    mode === 'production' && vitePrerender({
      staticDir: path.join(__dirname, 'dist'),
      routes: PRERENDER_ROUTES,
      // Wait for the main content to be rendered
      renderer: {
        renderAfterDocumentEvent: 'render-event',
        // Fallback timeout if event doesn't fire
        renderAfterTime: 5000,
        // Inject meta tag to indicate pre-rendered page
        injectProperty: '__PRERENDERED__',
      },
      postProcess(renderedRoute) {
        // Add prerender indicator comment
        renderedRoute.html = renderedRoute.html.replace(
          '</head>',
          '<!-- Pre-rendered by vite-plugin-prerender for SEO -->\n</head>'
        );
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
