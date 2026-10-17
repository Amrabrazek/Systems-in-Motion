import { expect, test } from '@playwright/test';

// The M2 smoke test (CLAUDE.md): kill a server, the survivor turns red.
test('killing one of two servers overloads the survivor', async ({ page }) => {
  await page.goto('/#/learn/load-balancer');
  const stage = page.getByRole('region', { name: 'Live system' });
  await expect(stage.getByText('✓ HEALTHY').first()).toBeVisible();

  await page.getByRole('button', { name: 'Kill Server B' }).click();
  await expect(stage.getByText('✕ DOWN').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Errors' }).locator('.chart-now')).not.toHaveText(
    '0.0%',
    { timeout: 10_000 },
  );
  await expect(stage.getByText('! OVERLOADED').first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Revive Server B' }).click();
  await expect(page.getByRole('button', { name: 'Kill Server B' })).toBeVisible();
  await expect(stage.getByText('! OVERLOADED')).toHaveCount(0, { timeout: 30_000 });
});

test('a third server gives the spare that survives a kill', async ({ page }) => {
  await page.goto('/#/learn/load-balancer');
  await page.getByRole('button', { name: 'Add a server' }).click();
  await expect(page.getByRole('group', { name: 'Number of servers' }).locator('output')).toHaveText(
    '3',
  );
  // The live tradeoff meter agrees before the kill, and flips once the spare is used up.
  const rightNow = page.getByRole('region', { name: 'Right now' });
  await expect(rightNow.getByText('✓ holds')).toBeVisible();
  await page.getByRole('button', { name: 'Kill Server C' }).click();
  await expect(rightNow.getByText('! fails')).toBeVisible();

  const stage = page.getByRole('region', { name: 'Live system' });
  await expect(stage.getByText('✕ DOWN').first()).toBeVisible();
  // Once the health check notices, A and B share the load without dropping anything.
  await expect(stage.getByText('sends to 2 of 3')).toBeVisible({ timeout: 10_000 });
  await expect(stage.getByText('! OVERLOADED')).toHaveCount(0);
});

test('a tradeoff row lights the boxes it is about', async ({ page }) => {
  await page.goto('/#/learn/load-balancer');
  const stage = page.locator('.flow-stage');
  await page.locator('.tradeoff-row--breaksNext').hover();
  // Breaks next is the spare: every server lights, the balancer does not.
  await expect(stage.locator('.flow-box--router.is-lit')).toHaveCount(0);
  await expect(stage.locator('.flow-box.is-lit')).toHaveCount(2);
  await page.locator('.tradeoff-row--fixes').hover();
  await expect(stage.locator('.flow-box--router.is-lit')).toHaveCount(1);
  await page.locator('.tradeoff-row--cost').hover();
  await expect(stage.locator('.is-lit')).toHaveCount(0);
});
