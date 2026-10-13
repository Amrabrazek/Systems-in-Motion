import { expect, test } from '@playwright/test';

// Engine tests can't catch a blank page; this can. M1 step 5 extends it to
// "raise users, server turns red".
test('home loads and links to the first topic', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Watch software systems behave live' }),
  ).toBeVisible();

  await page.getByRole('link', { name: /One server/ }).click();
  await expect(page).toHaveURL(/#\/learn\/one-server$/);
  await expect(page.getByRole('heading', { name: 'One server' })).toBeVisible();
});

test('design page and unknown routes render inside the shell', async ({ page }) => {
  await page.goto('/#/design');
  await expect(page.getByRole('heading', { name: 'Design' })).toBeVisible();

  await page.goto('/#/nowhere');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
