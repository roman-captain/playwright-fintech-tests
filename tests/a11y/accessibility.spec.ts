import { test } from '@playwright/test';

/**
 * Accessibility Tests – axe-core (WCAG 2.1 AA)
 *
 * Full implementation: https://github.com/roman-captain/playwright-tests-new
 *
 * Purpose: verify that the UI is accessible to users with disabilities.
 * Required for fintech products under EU EAA (European Accessibility Act, 2025).
 *
 * How it works on the real project:
 * 1. axe-playwright runs axe-core engine on each page
 * 2. Reports violations by severity: critical, serious, moderate, minor
 * 3. CI fails on critical/serious violations
 * 4. Runs on every PR for changed UI components
 *
 * WCAG 2.1 AA criteria covered:
 * - 1.1.1 Non-text Content – images have alt text
 * - 1.4.3 Contrast Ratio – text/background minimum 4.5:1
 * - 2.1.1 Keyboard Navigation – all interactive elements reachable by Tab
 * - 2.4.3 Focus Order – logical focus sequence on forms
 * - 4.1.2 Name, Role, Value – form inputs have labels
 *
 * Why separate / not active here:
 * Requires @axe-core/playwright package and browser in non-headless mode
 * for accurate colour contrast checks. Full suite in playwright-tests-new.
 */

test.skip('A11Y-01 – login page: no critical accessibility violations', async ({ page }) => {
  await page.goto('/');
  // const { checkA11y } = await import('axe-playwright');
  // await checkA11y(page, undefined, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
});

test.skip('A11Y-02 – dashboard: form labels and ARIA roles present', async ({ page }) => {
  await page.goto('/dashboard.html');
  // await checkA11y(page);
});

test.skip('A11Y-03 – payment form: all inputs have accessible labels', async ({ page }) => {
  await page.goto('/payment.html');
  // await checkA11y(page);
});

test.skip('A11Y-04 – transaction history: table has proper header roles', async ({ page }) => {
  await page.goto('/history.html');
  // await checkA11y(page);
});
