import { expect,test } from '@playwright/test'

test('links a catalog image to its tool and expands sidebar categories on demand',async({page})=>{
  await page.goto('./')
  const sidebar=page.locator('aside nav')
  const category=sidebar.getByRole('button',{name:'Color y tokens',exact:true})
  await expect(category).toHaveAttribute('aria-expanded','false')
  await expect(sidebar.getByRole('link',{name:'Gradientes',exact:true})).toHaveCount(0)
  await category.click()
  await expect(category).toHaveAttribute('aria-expanded','true')
  await expect(sidebar.getByRole('link',{name:'Gradientes',exact:true})).toBeVisible()
  await category.click()
  await expect(category).toHaveAttribute('aria-expanded','false')
  const link=page.getByRole('main').getByRole('link',{name:'Gradientes',exact:true})
  const image=link.locator('img')
  await image.scrollIntoViewIfNeeded()
  await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.naturalWidth)).toBeGreaterThan(100)
  await image.click()
  await expect(page).toHaveURL(/\/tools\/gradient$/)
})


test('renders a linked image for every catalog item and keeps mobile categories collapsible',async({page})=>{
  await page.goto('./')
  const cards=page.locator('.tool-card .card-link')
  await expect(cards.first()).toBeVisible()
  const previews=await cards.evaluateAll(links=>links.map(link=>({
    href:link.getAttribute('href'), src:link.querySelector('img')?.currentSrc || link.querySelector('img')?.getAttribute('src'),
  })))
  expect(previews.length).toBeGreaterThan(0)
  expect(new Set(previews.map(entry=>entry.href)).size).toBe(previews.length)
  for(const preview of previews){
    expect(preview.href).toMatch(/\/tools\/[\w-]+$/)
    expect(preview.src).toBeTruthy()
  }

  await page.setViewportSize({width:390,height:800})
  await page.getByRole('button',{name:'Menú',exact:true}).click()
  const nav=page.getByRole('dialog').getByRole('navigation')
  const category=nav.getByRole('button',{name:'Color y tokens',exact:true})
  await expect(category).toHaveAttribute('aria-expanded','false')
  await category.press('Enter')
  await expect(category).toHaveAttribute('aria-expanded','true')
  await nav.getByRole('link',{name:'Gradientes',exact:true}).click()
  await expect(page).toHaveURL(/\/tools\/gradient$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
