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
  await page.getByRole('button', { name: 'Kill Server C' }).click();

  const stage = page.getByRole('region', { name: 'Live system' });
  await expect(stage.getByText('✕ DOWN').first()).toBeVisible();
  // Once the health check notices, A and B share the load without dropping anything.
  await expect(stage.getByText('sends to 2 of 3')).toBeVisible({ timeout: 10_000 });
  await expect(stage.getByText('! OVERLOADED')).toHaveCount(0);
});
