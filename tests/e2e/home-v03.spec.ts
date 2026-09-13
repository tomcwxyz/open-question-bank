import { test, expect } from '@playwright/test'

test('the public front door leads with questions and enquiries', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Start with what we need to figure out.' })).toBeVisible()
  await expect(page.getByLabel('Your question')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add this question →' })).toBeVisible()

  await expect(page.getByRole('link', { name: 'Questions' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Enquiries' })).toBeVisible()

  await expect(page.getByText('canonical', { exact: true })).toHaveCount(0)
  await expect(page.getByText('definedness', { exact: true })).toHaveCount(0)
  await expect(page.getByText('TrueSkill', { exact: true })).toHaveCount(0)
})
