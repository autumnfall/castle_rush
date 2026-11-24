import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const depsPath = join(__dirname, 'deps', 'usr', 'lib', 'x86_64-linux-gnu');

export default {
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  workers: 1,
  forbidOnly: !!process.env.CI,
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: false,
  },
};

// 设置本地库路径，让 Chromium 能找到 libnss3 等依赖
if (!process.env.CI && !process.env.LD_LIBRARY_PATH?.includes(depsPath)) {
  process.env.LD_LIBRARY_PATH = depsPath + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
}
