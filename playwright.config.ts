import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.spec.ts',fullyParallel:false,workers:1,
 use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:3000',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']},trace:'off'},
 reporter:'list',outputDir:process.env.TEST_OUTPUT_DIR||'test-results',
});
