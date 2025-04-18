
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Debug logging
  console.log('Vite config environment variables:', {
    mode,
    VITE_API_URL: env.VITE_API_URL,
    NODE_ENV: process.env.NODE_ENV
  });
  
  // Production API URL and domains
  const productionApiUrl = 'https://dashgatherer-api.onrender.com';
  const allowedDomains = ['trimpbara.space', 'dashgatherer-api.onrender.com'];
  
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Ensure environment variables are available in the client
      'import.meta.env.VITE_API_URL': JSON.stringify(mode === 'production' ? productionApiUrl : (env.VITE_API_URL || 'http://localhost:5001')),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(env.VITE_SUPABASE_PROJECT_ID || 'eeaebxnbcxhzafzpzqsu'),
      'import.meta.env.VITE_ALLOWED_DOMAINS': JSON.stringify(allowedDomains),
    },
    build: {
      // Ensure environment variables are properly replaced in production build
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  };
});
