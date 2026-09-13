import { test, expect } from '@playwright/test'

// Admin promotes a few canonical questions; an ANONYMOUS visitor searches the Questions surface,
// opens a question, and sees related questions without any submitter identity leaking.
test('the public can search the bank, open a question, and see related questions', async ({ page, browser }) => {
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const term = `zphrase${stamp.replace(/[^a-z0-9]/gi, '')}`

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

  await makeCanonical(`How can our town improve ${term} for residents?`)
  await makeCanonical(`What would better ${term} look like locally?`)

  const anon = await browser.newContext()
  const vp = await anon.newPage()

  await vp.goto('/browse')
  await vp.getByLabel('Search questions').fill(term)
  await vp.getByRole('button', { name: 'Search', exact: true }).click()

  const firstResult = vp.locator('article', { hasText: term }).first()
  await expect(firstResult).toBeVisible()
  await firstResult.getByRole('link').click()

  await expect(vp).toHaveURL(/\/questions\/[0-9a-f-]+/)
  await expect(vp.getByRole('heading', { name: 'Related questions' })).toBeVisible()
  await expect(vp.getByText(/submitter|secret-token/i)).toHaveCount(0)

  await anon.close()
})
