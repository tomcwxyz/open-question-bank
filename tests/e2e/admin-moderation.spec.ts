import { test, expect } from '@playwright/test'

// Playwright runs its own dev server on port 3100 (see playwright.config.ts). Requires the
// docker stack (Postgres/Ollama) up, the dev db seeded, and ADMIN_PASSWORD/ADMIN_SESSION_SECRET in .env.
test('admin reviews and approves a pending question', async ({ page, request }) => {
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const unique = `e2e moderation ${Date.now()} — what should councils prioritise for coastal erosion?`

  const created = await request.post('/api/questions', {
    data: { rawText: unique, visibility: 'public', decision: { type: 'new' } },
  })
  expect(created.ok()).toBeTruthy()

  await page.goto('/admin/moderation')
  await expect(page).toHaveURL(/\/admin\/login/)

  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/\/admin\/moderation/)
  await expect(page.getByRole('heading', { name: 'What should enter the question bank?' })).toBeVisible()

  const row = page.locator('li', { hasText: unique })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Approve question' }).click()

  await expect(page.getByRole('status')).toContainText(/approved/i)
})
