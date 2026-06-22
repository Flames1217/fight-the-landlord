import { expect, test } from '@playwright/test';

test('desktop table clearly exposes cards, turns and persistent panels', async ({ page }) => {
  await page.goto('/?demo=table');

  await expect(page.getByLabel('手牌')).toBeVisible();
  await expect(page.getByLabel('底牌')).toBeVisible();
  await expect(page.getByLabel('记牌器')).toBeVisible();
  await expect(page.getByText('轮到你出牌')).toBeVisible();
  await expect(page.getByText('房间聊天')).toBeVisible();
  await expect(page.getByText('对局历史')).toBeVisible();
  await expect(page.getByRole('button', { name: '出牌' })).toBeVisible();
  await expect(page.getByRole('button', { name: '托管：关' })).toBeVisible();
});

test('bidding demo shows bidding actions instead of play actions', async ({ page }) => {
  await page.goto('/?demo=bidding');

  await expect(page.getByText('轮到你叫地主')).toBeVisible();
  await expect(page.getByRole('button', { name: '叫地主' })).toBeVisible();
  await expect(page.getByRole('button', { name: '不叫' })).toBeVisible();
  await expect(page.getByRole('button', { name: '出牌' })).toHaveCount(0);
});

test('managed mode is toggleable and persistent', async ({ page }) => {
  await page.goto('/?demo=table');
  await page.evaluate(() => localStorage.removeItem('ddz_web_managed'));
  await page.reload();

  const managed = page.getByRole('button', { name: '托管：关' });
  await managed.click();
  await expect(page.getByRole('button', { name: '托管：开' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ddz_web_managed'))).toBe('true');
});

test('result screen lays out cards horizontally and scrolls on short viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/?demo=result');

  await expect(page.getByText('本局积分')).toBeVisible();
  await expect(page.getByText('剩余手牌')).toBeVisible();
  await expect(page.getByRole('button', { name: '再来一局' })).toBeVisible();

  const result = page.locator('.result-screen');
  const metrics = await result.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    cardRowDisplay: getComputedStyle(element.querySelector('.played-cards__row')!).display
  }));
  expect(metrics.overflowY).toBe('auto');
  expect(metrics.cardRowDisplay).toBe('flex');
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  await result.evaluate((element) => {
    element.scrollTop = 500;
  });
  await expect.poll(() => result.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});
