import { request } from '@playwright/test';

async function globalSetup() {
  const context = await request.newContext();
  await context.post('http://localhost:3001/api/v1/test/reset');
  await context.dispose();
  console.log('[global-setup] Server state reset to seed data');
}

export default globalSetup;
