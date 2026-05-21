export default {
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  workers: 1,
};
