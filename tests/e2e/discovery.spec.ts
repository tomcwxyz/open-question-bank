import { test, expect } from '@playwright/test'

// Admin creates a completed enquiry, an enquiry being prioritised, and a canonical question;
// an ANONYMOUS context discovers them through the public Enquiries and Questions surfaces.
test('the public can discover enquiries and questions without a direct link', async ({ page, browser }) => {
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto('/admin/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/\/admin\/moderation/)

  async function makeCanonical(text: string): Promise<string> {
    const created = await page.request.post('/api/questions', {
      data: { rawText: text, visibility: 'public', decision: { type: 'new' } },
    })
    const { question } = await created.json()
    await page.request.post(`/api/admin/questions/${question.id}/approve`)
    await page.request.post(`/api/admin/questions/${question.id}/promote`)
    return question.id
  }

  const ca = await makeCanonical(`discover A ${stamp}`)
  const cb = await makeCanonical(`discover B ${stamp}`)
  const comp = await page.request.post('/api/admin/campaigns', {
    data: { prompt: `discover prioritising ${stamp}`, comparisonAxis: 'importance' },
  })
  const comparing = (await comp.json()).campaign
  await page.request.post(`/api/admin/campaigns/${comparing.id}/questions`, { data: { questionIds: [ca, cb] } })
  await page.request.post(`/api/admin/campaigns/${comparing.id}/open`)

  const da = await makeCanonical(`discover C ${stamp}`)
  const dbq = await makeCanonical(`discover D ${stamp}`)
  const clo = await page.request.post('/api/admin/campaigns', {
    data: { prompt: `discover completed ${stamp}`, comparisonAxis: 'importance' },
  })
  const closed = (await clo.json()).campaign
  await page.request.post(`/api/admin/campaigns/${closed.id}/questions`, { data: { questionIds: [da, dbq] } })
  await page.request.post(`/api/admin/campaigns/${closed.id}/open`)
  await page.request.post(`/api/admin/campaigns/${closed.id}/comparisons`, {
    data: { questionAId: da, questionBId: dbq, winnerQuestionId: da },
  })
  await page.request.post(`/api/admin/campaigns/${closed.id}/close`)

  const anon = await browser.newContext()
  const vp = await anon.newPage()

  await vp.goto('/campaigns')
  const completedRow = vp.locator('li', { hasText: `discover completed ${stamp}` })
  await expect(completedRow).toBeVisible()
  const prioritisingRow = vp.locator('li', { hasText: `discover prioritising ${stamp}` })
  await expect(prioritisingRow).toBeVisible()
  await expect(prioritisingRow.getByRole('link', { name: 'Help decide what matters most →' })).toBeVisible()

  await completedRow.getByRole('link', { name: 'See what rose to the top →' }).click()
  await expect(vp.getByRole('heading', { name: `discover completed ${stamp}` })).toBeVisible()
  await expect(vp.getByRole('heading', { name: 'What rose to the top' })).toBeVisible()

  // Completed enquiry questions are ranked and remain in the shared bank.
  await vp.goto('/questions')
  await expect(vp.getByText(`discover C ${stamp}`)).toBeVisible()
  await anon.close()
})
