import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const depsPath = join(__dirname, 'deps', 'usr', 'lib', 'x86_64-linux-gnu');

export default {
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  workers: 1,
  webServer: {
    command: './start.sh',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
  },
};

// 设置本地库路径，让 Chromium 能找到 libnss3 等依赖
if (!process.env.LD_LIBRARY_PATH?.includes(depsPath)) {
  process.env.LD_LIBRARY_PATH = depsPath + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
}
