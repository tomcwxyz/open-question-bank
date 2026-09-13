import { test, expect } from '@playwright/test'

// An anonymous visitor lands on /browse, sees the participant-facing Questions experience,
// can search (questions -> results -> back), and can drill into a theme. Builds its own data
// via the admin API.
test('questions experience supports discovery, search, and theme filtering', async ({ page, browser }) => {
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto('/admin/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/\/admin\/moderation/)

  // Create + approve + promote a canonical, themed question via the admin API (mock provider
  // classifies it on approval).
  const text = `should we add protected cycle lanes for ${stamp}?`
  const created = await page.request.post('/api/questions', {
    data: { rawText: text, visibility: 'public', decision: { type: 'new' } },
  })
  const { question } = await created.json()
  await page.request.post(`/api/admin/questions/${question.id}/approve`)
  await page.request.post(`/api/admin/questions/${question.id}/promote`)

  const anon = await browser.newContext()
  const vp = await anon.newPage()

  await vp.goto('/browse')
  await expect(vp.getByRole('heading', { name: 'What are people trying to figure out?' })).toBeVisible()

  const newSection = vp.locator('section').filter({
    has: vp.getByRole('heading', { name: 'New' }),
  })
  await expect(newSection.getByText(text)).toBeVisible()

  // Search swaps the discovery view for results, then returns cleanly.
  await vp.getByLabel('Search questions').fill('cycle lanes')
  await vp.getByRole('button', { name: 'Search' }).click()
  await expect(vp.getByText(text)).toBeVisible()
  await vp.getByRole('button', { name: /Back to questions/ }).click()
  await expect(vp.getByRole('heading', { name: 'Rising' })).toBeVisible()

  // Theme filtering stays available but is secondary to the main discovery experience.
  await vp.getByRole('button', { name: 'Transport & Streets' }).click()
  await expect(vp.getByText(text)).toBeVisible()

  await anon.close()
})
