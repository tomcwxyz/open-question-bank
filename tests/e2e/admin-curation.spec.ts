import { test, expect } from '@playwright/test'

// Requires the docker stack up, the dev db seeded, and ADMIN_PASSWORD/ADMIN_SESSION_SECRET in .env.
// The dev server runs with REASONING_PROVIDER=mock (see playwright.config.ts), so no live model is needed.
test('admin quality-checks then publishes a question into the live bank', async ({ page, request }) => {
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const unique = `e2e curation ${Date.now()} — how do we fix education?`

  const created = await request.post('/api/questions', {
    data: { rawText: unique, visibility: 'public', decision: { type: 'new' } },
  })
  expect(created.ok()).toBeTruthy()
  const {
    question: { id },
  } = await created.json()

  await page.goto('/admin/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/\/admin\/moderation/)

  const approve = await page.request.post(`/api/admin/questions/${id}/approve`)
  expect(approve.ok()).toBeTruthy()

  await page.goto('/admin/curation')
  await expect(page.getByRole('heading', { name: 'Decide what becomes public' })).toBeVisible()
  const row = page.locator('li', { hasText: unique }).first()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Review for publication →' }).click()

  // The quality check is explicitly optional, but still available as advice.
  await page.getByRole('button', { name: 'Get an AI quality check' }).click()
  await expect(page.getByText(/4\.0 \/ 5 average/)).toBeVisible()
  await expect(page.getByText('specific')).toBeVisible()
  await expect(page.getByText('mock specific rationale')).toBeVisible()

  await page.getByRole('button', { name: 'Publish to question bank' }).click()
  await expect(page.getByRole('status')).toContainText(/published to the question bank/i)

  // Publishing removes it from the decision queue but keeps it visible in the live bank.
  const readySection = page.getByRole('heading', { name: 'Ready to publish' }).locator('..')
  await expect(readySection).not.toContainText(unique)
  const liveSection = page.getByRole('heading', { name: 'Live question bank' }).locator('..')
  await expect(liveSection).toContainText(unique)

  // State really is canonical now; scores persist as provenance/advice.
  const again = await page.request.post(`/api/admin/questions/${id}/promote`)
  expect(again.status()).toBe(409)
  const scores = await page.request.get(`/api/admin/questions/${id}/scores`)
  const { history } = await scores.json()
  expect(history).toHaveLength(5)
})
