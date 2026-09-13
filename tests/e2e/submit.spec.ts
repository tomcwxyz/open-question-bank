import { test, expect } from '@playwright/test'

// Requires: docker compose up and the embedding model pulled. The e2e dev server runs
// against the TEST database (see playwright.config.ts + global-setup.ts), never the dev
// `qb` DB, so this submission can't pollute your dev data. The unique phrase still avoids
// dedup collisions across runs within the test DB.
test('a new question can be added through the discovery-first composer', async ({ page }) => {
  const unique = `e2e probe ${Date.now()} — what should councils prioritise for flood defence?`

  await page.goto('/submit')
  await expect(page.getByRole('heading', { name: 'Ask a question' })).toBeVisible()
  await page.getByLabel('Your question').fill(unique)
  await page.getByRole('button', { name: 'Add this question →' }).click()

  const created = page.getByText(/Added\. We’ll check it|Added as a new question/i)
  const chooseNew = page.getByRole('button', { name: 'Mine is different — add it' })

  await expect(created.or(chooseNew)).toBeVisible()
  if (await chooseNew.isVisible()) {
    await chooseNew.click()
  }
  await expect(page.getByRole('status')).toBeVisible()
})
