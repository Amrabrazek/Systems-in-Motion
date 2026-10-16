import { expect, test } from '@playwright/test';

// Explainer smoke test: the page loads, steps move both ways, and the live link works.
test('stepping through how systems scale', async ({ page }) => {
  await page.goto('/#/learn/how-systems-scale');
  const position = page.locator('.scale-position');
  await expect(position).toContainText('Step 1 of 10');
  await expect(page.getByRole('button', { name: '← Back' })).toBeDisabled();

  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(position).toContainText('Bigger server');

  await page.keyboard.press('ArrowRight');
  await expect(position).toContainText('More servers');
  await expect(page.getByRole('article', { name: /Load balancer \+ more servers/ })).toBeVisible();

  // The tradeoffs sit with the picture: pointing at "Breaks next" lights the box that breaks.
  await page.locator('.tradeoff-row--breaksNext').hover();
  await expect(page.locator('.scale-diagram--wide .scale-part--db')).toHaveClass(/is-lit/);
  await page.locator('.tradeoff-row--cost').hover();
  await expect(page.locator('.scale-diagram--wide .is-lit')).toHaveCount(0);

  await page.getByRole('button', { name: /Second region/ }).click();
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled();

  await page.getByRole('button', { name: /More servers/ }).click();
  await page.getByRole('link', { name: /Try it live/ }).click();
  await expect(page).toHaveURL(/#\/learn\/load-balancer$/);
});
