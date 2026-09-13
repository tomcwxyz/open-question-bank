import { test, expect } from '@playwright/test'

// Admin opens an enquiry for submissions; an ANONYMOUS visitor finds it, can visit its durable
// public home, and submits a question into it.
test('the public can join an enquiry that is gathering questions', async ({ page, browser }) => {
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const prompt = `front-door enquiry ${stamp}`

  await page.goto('/admin/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/\/admin\/moderation/)

  const created = await page.request.post('/api/admin/campaigns', {
    data: { prompt, comparisonAxis: 'importance' },
  })
  const { campaign } = await created.json()
  const opened = await page.request.post(`/api/admin/campaigns/${campaign.id}/open-submission`)
  expect(opened.ok()).toBeTruthy()

  const anon = await browser.newContext()
  const vp = await anon.newPage()

  await vp.goto('/campaigns')
  await expect(vp.getByRole('heading', { name: 'Questions people are exploring together' })).toBeVisible()
  const row = vp.locator('li', { hasText: prompt })
  await expect(row).toBeVisible()

  // The enquiry title has a durable home throughout its lifecycle.
  await row.getByRole('link', { name: prompt }).click()
  await expect(vp).toHaveURL(new RegExp(`/campaigns/${campaign.id}$`))
  await expect(vp.getByRole('heading', { name: prompt })).toBeVisible()
  await expect(vp.getByText(/still gathering the questions/i)).toBeVisible()

  await vp.getByRole('link', { name: 'Add what we should ask →' }).click()
  await expect(vp).toHaveURL(new RegExp(`/campaigns/${campaign.id}/submit`))
  await expect(vp.getByRole('heading', { name: prompt })).toBeVisible()

  const questionText = `should we fund ${stamp} for the neighbourhood?`
  await vp.getByLabel('Your question').fill(questionText)
  await vp.getByRole('button', { name: 'Submit' }).click()

  const chooseNew = vp.getByRole('button', { name: /None of these/ })
  const success = vp.getByText(/added|Thanks/i)
  await expect(chooseNew.or(success).first()).toBeVisible()
  if (await chooseNew.isVisible()) await chooseNew.click()

  await expect(success).toBeVisible()
  await anon.close()
})
