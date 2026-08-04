import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Custom plugin to serve the /data folder during development
function serveDataPlugin() {
  return {
    name: 'serve-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const filePath = path.resolve(import.meta.dirname, 'data', req.url.slice(1));
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(fs.readFileSync(filePath));
        } else {
          next();
        }
      });
    }
  }
}

// Custom plugin to serve index.dev.html during development instead of the redirect index.html
function devHtmlPlugin() {
  return {
    name: 'dev-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
          const filePath = path.resolve(import.meta.dirname, 'index.dev.html');
          res.setHeader('Content-Type', 'text/html');
          res.end(fs.readFileSync(filePath, 'utf-8'));
          return;
        }
        next();
      });
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    devHtmlPlugin(),
    tailwindcss(),
    react(),
    serveDataPlugin()
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.dev.html'
    }
  }
})
