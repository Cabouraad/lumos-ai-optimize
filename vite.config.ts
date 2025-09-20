import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Keep React core in main bundle to avoid createContext timing issues
          // Only split non-core React libraries
          if (id.includes('react-router-dom')) {
            return 'router-vendor';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase-vendor';
          }
          if (id.includes('lucide-react') || id.includes('framer-motion')) {
            return 'ui-vendor';
          }
          // Split heavy components that aren't needed on landing page
          if (id.includes('Dashboard') || 
              id.includes('Prompts') || 
              id.includes('Reports') || 
              id.includes('Settings') ||
              id.includes('AuditRuns') ||
              id.includes('DebugTools') ||
              id.includes('DomainResolverDiagnostics')) {
            return 'dashboard-heavy';
          }
        }
      }
    },
    // Enable better tree shaking
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
    }
  }
}));
