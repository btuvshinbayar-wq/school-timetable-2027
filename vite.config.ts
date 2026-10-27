import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function autobackupPlugin(): Plugin {
  const handler = (server: any) => {
    // 1. List backups
    server.middlewares.use('/api/backup/list', (_req: any, res: any) => {
      try {
        const backupsDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(backupsDir)) {
          fs.mkdirSync(backupsDir, { recursive: true });
        }
        const pad = (n: number) => String(n).padStart(2, '0');
        const files = fs
          .readdirSync(backupsDir)
          .filter((f: string) => f.endsWith('.json'))
          .map((filename: string) => {
            const filePath = path.join(backupsDir, filename);
            const stat = fs.statSync(filePath);
            const d = new Date(stat.mtime);
            const displayTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            return {
              filename,
              size: stat.size,
              mtime: stat.mtime.toISOString(),
              displayTime,
            };
          })
          .sort((a: any, b: any) => b.mtime.localeCompare(a.mtime));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, backups: files, path: backupsDir }));
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err?.message || 'Failed to list backups' }));
      }
    });

    // 2. Load backup by filename
    server.middlewares.use('/api/backup/load', (req: any, res: any, next: any) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const { filename } = JSON.parse(body || '{}');
            const safeName = path.basename(filename || '');
            const backupsDir = path.resolve(process.cwd(), 'backups');
            const target = path.join(backupsDir, safeName);
            if (!fs.existsSync(target)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Файл олдсонгүй' }));
              return;
            }
            const content = fs.readFileSync(target, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: JSON.parse(content) }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Failed to load backup' }));
          }
        });
      } else {
        next();
      }
    });

    // 3. Create autobackup file with date, hour, minute
    server.middlewares.use('/api/backup', (req: any, res: any, next: any) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const backupsDir = path.resolve(process.cwd(), 'backups');
            if (!fs.existsSync(backupsDir)) {
              fs.mkdirSync(backupsDir, { recursive: true });
            }
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const rawName = data.projectName || data.settings?.schoolName || 'timetable';
            const cleanName = String(rawName).replace(/[\s\W]+/g, '_').slice(0, 40);
            const filename = `backup_${dateStr}_${cleanName}.json`;
            const filePath = path.join(backupsDir, filename);

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            // Also maintain latest_backup.json
            fs.writeFileSync(path.join(backupsDir, 'latest_backup.json'), JSON.stringify(data, null, 2), 'utf-8');

            const displayTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                filename,
                path: filePath,
                displayTime,
                isoTime: now.toISOString(),
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Failed to write backup' }));
          }
        });
      } else {
        next();
      }
    });
  };

  return {
    name: 'autobackup-plugin',
    configureServer(server) {
      handler(server);
    },
    configurePreviewServer(server) {
      handler(server);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      autobackupPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'School Timetable (aSc Style)',
          short_name: 'Timetable',
          description: 'aSc Timetables загварын сургуулийн хичээлийн хуваарь зохиогч',
          theme_color: '#2563eb',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

