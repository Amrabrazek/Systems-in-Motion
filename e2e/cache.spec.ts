import { expect, test } from '@playwright/test';

// Topic 3 smoke test: the database is the bottleneck, a cache hides it, killing the cache brings it back.
test('a cache rescues the database until it dies', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/#/learn/cache');
  const stage = page.getByRole('region', { name: 'Live system' });
  await expect(stage.getByText('! OVERLOADED').first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: '+ Add a cache' }).click();
  // It starts empty, warms up, and the database recovers.
  await expect(stage.getByText('~ WARMING UP').first()).toBeVisible();
  await expect(stage.getByText('✓ WARM').first()).toBeVisible({ timeout: 45_000 });
  await expect(stage.getByText('! OVERLOADED')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText('Users may see answers up to 30 s old.')).toBeVisible();

  await page.getByRole('button', { name: '✕ Kill the cache' }).click();
  await expect(stage.getByText('✕ DOWN').first()).toBeVisible();
  await expect(stage.getByText('! OVERLOADED').first()).toBeVisible({ timeout: 15_000 });
});

test('the tradeoff rows light the cache and the database', async ({ page }) => {
  await page.goto('/#/learn/cache');
  await page.getByRole('button', { name: '+ Add a cache' }).click();
  const stage = page.locator('.flow-stage');
  // The cache joins on the next sim step; only then does the Fixes row have a box to light.
  await expect(stage.getByText('~ WARMING UP')).toBeVisible();
  await page.locator('.tradeoff-row--fixes').hover();
  await expect(stage.locator('.flow-box.is-lit')).toHaveCount(1);
  await expect(stage.locator('.flow-box-halo--fix')).toHaveCount(1);
  await page.locator('.tradeoff-row--breaksNext').hover();
  await expect(stage.locator('.flow-box-halo--limit')).toHaveCount(1);
});

test('the explainer’s cache step links here', async ({ page }) => {
  await page.goto('/#/learn/how-systems-scale');
  await page.getByRole('button', { name: /Cache/ }).first().click();
  await page.getByRole('link', { name: /Try it live/ }).click();
  await expect(page).toHaveURL(/#\/learn\/cache$/);
});
