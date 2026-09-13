import { test, expect } from '@playwright/test'

// Requires the docker stack up + dev db seeded; the dev server runs with
// REASONING_PROVIDER=mock (playwright.config.ts) but this flow uses no model.
test('admin runs an enquiry from preparation into prioritisation', async ({ page }) => {
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const stamp = Date.now()

  async function makeCanonical(text: string): Promise<string> {
    const created = await page.request.post('/api/questions', {
      data: { rawText: text, visibility: 'public', decision: { type: 'new' } },
    })
    const { question } = await created.json()
    await page.request.post(`/api/admin/questions/${question.id}/approve`)
    await page.request.post(`/api/admin/questions/${question.id}/promote`)
    return question.id
  }

  await page.goto('/admin/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/\/admin\/moderation/)

  const textA = `e2e campaign A ${stamp}`
  const textB = `e2e campaign B ${stamp}`
  await makeCanonical(textA)
  await makeCanonical(textB)

  const campaignPrompt = `e2e prompt ${stamp}`
  await page.goto('/admin/campaigns')
  await expect(page.getByRole('heading', { name: 'Run collective enquiry' })).toBeVisible()
  await page.getByLabel('Enquiry question or prompt').fill(campaignPrompt)
  await page.getByRole('button', { name: 'Create enquiry' }).click()

  const row = page.locator('li', { hasText: campaignPrompt })
  await expect(row).toBeVisible()
  await row.getByRole('link', { name: 'Set up enquiry →' }).click()
  await expect(page.getByRole('heading', { name: campaignPrompt })).toBeVisible()
  await expect(page.getByText('Preparing', { exact: true })).toBeVisible()

  // Add both published questions from the collapsed bank picker.
  await page.getByText(/Add questions from the bank/).click()
  await page.locator('li', { hasText: textA }).getByRole('button', { name: 'Add to enquiry' }).click()
  await page.locator('li', { hasText: textB }).getByRole('button', { name: 'Add to enquiry' }).click()

  await page.getByRole('button', { name: 'Start prioritisation' }).click()
  await expect(page.getByText('Prioritising', { exact: true })).toBeVisible()

  // Preview one pair and contribute a comparison; an emerging ranking appears.
  await page.getByText('Preview the comparison experience').click()
  await page.getByRole('button', { name: 'Preview next pair' }).click()
  await page.getByRole('button', { name: new RegExp(`e2e campaign [AB] ${stamp}`) }).first().click()
  await expect(page.getByText(/1 head-to-head comparison/).first()).toBeVisible()
})
