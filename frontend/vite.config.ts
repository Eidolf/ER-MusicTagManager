import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Try to read VERSION file
let appVersion = 'dev'
try {
    const versionPath = path.resolve(__dirname, '../VERSION')
    if (fs.existsSync(versionPath)) {
        appVersion = fs.readFileSync(versionPath, 'utf-8').trim()
    }
} catch (e) {
    console.warn("Could not read VERSION file", e)
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        '__APP_VERSION__': JSON.stringify(appVersion)
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        strictPort: true,
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:13010',
                changeOrigin: true
            }
        }
    }
})
