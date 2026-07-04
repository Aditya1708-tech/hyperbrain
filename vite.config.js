import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'

// Custom local API handler mock for Vercel serverless functions
const apiMiddleware = () => ({
  name: 'api-middleware',
  configureServer(server) {
    // Load .env variables into process.env for Node.js API handlers
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const equalsIdx = trimmed.indexOf('=');
          if (equalsIdx !== -1) {
            const key = trimmed.substring(0, equalsIdx).trim();
            const value = trimmed.substring(equalsIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key) {
              process.env[key] = value;
            }
          }
        }
      });
    }

    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        const apiName = url.pathname.slice(5); // e.g. "welcome" or "send-email"
        const apiPath = path.resolve(__dirname, `api/${apiName}.js`);
        
        if (fs.existsSync(apiPath)) {
          try {
            // Load the module dynamically
            const fileUrl = pathToFileURL(apiPath).href;
            const module = await import(`${fileUrl}?t=${Date.now()}`);
            const handler = module.default;
            
            // Parse body
            let body = {};
            if (req.method === 'POST') {
              body = await new Promise((resolve) => {
                let data = '';
                req.on('data', chunk => { data += chunk; });
                req.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    resolve({});
                  }
                });
              });
            }

            // Create mocked req/res
            const mockReq = {
              method: req.method,
              url: req.url,
              query: Object.fromEntries(url.searchParams),
              body: body,
              headers: req.headers
            };

            const mockRes = {
              status(statusCode) {
                res.statusCode = statusCode;
                return this;
              },
              json(jsonData) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(jsonData));
                return this;
              },
              send(data) {
                res.end(data);
                return this;
              }
            };

            await handler(mockReq, mockRes);
            return;
          } catch (err) {
            console.error(`Error executing API handler ${apiName}:`, err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: err.message }));
            return;
          }
        }
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
