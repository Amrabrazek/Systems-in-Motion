import { expect, test } from '@playwright/test';

// The M1 smoke test (CLAUDE.md): page loads, raise users, server turns red.
test('raising users overloads the one server', async ({ page }) => {
  await page.goto('/#/learn/one-server');
  const stage = page.getByRole('region', { name: 'Live system' });
  await expect(stage.getByText('✓ HEALTHY').first()).toBeVisible();

  await page.getByRole('slider').focus();
  await page.keyboard.press('End'); // 10,000 users
  await expect(page.getByText('Users 10,000')).toBeVisible();

  await expect(stage.getByText('! OVERLOADED').first()).toBeVisible({ timeout: 10_000 });
  await expect(stage.getByText('turned away')).toBeVisible();
});

test('pause stops the clock and reset brings the server back', async ({ page }) => {
  await page.goto('/#/learn/one-server');
  await page.getByRole('slider').focus();
  await page.keyboard.press('End');
  const stage = page.getByRole('region', { name: 'Live system' });
  await expect(stage.getByText('! OVERLOADED').first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Pause/ }).click();
  await expect(page.getByRole('button', { name: /Play/ })).toBeVisible();

  await page.getByRole('button', { name: /Reset/ }).click();
  await page.getByRole('button', { name: /Play/ }).click();
  await expect(stage.getByText('✓ HEALTHY').first()).toBeVisible();
  await expect(page.getByText('Users 100', { exact: true })).toBeVisible();
});

test('arrow keys move the users slider in small steps', async ({ page }) => {
  await page.goto('/#/learn/one-server');
  await page.getByRole('slider').focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Users 100', { exact: true })).toBeHidden();
});
