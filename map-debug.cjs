const { chromium } = require('playwright-core')
const { SignJWT } = require('jose')

const SECRET = 'caaebcbee071454d67a1b3ced3d46e1e767fb61facd06f04d24093fd3fcc801f'
const BASE = 'https://mm.020504.xyz'

async function main() {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('1')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET))

  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome',
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const httpErrors = []
  let captured = false
  page.on('response', async (res) => {
    if (res.status() === 503 && res.url().includes('/_nuxt/') && !captured) {
      captured = true
      const h = res.headers()
      const req = res.request()
      httpErrors.push('RESP-HEADERS: ' + JSON.stringify(h))
      httpErrors.push('REQ-HEADERS: ' + JSON.stringify(req.headers()))
    }
  })

  await page.addInitScript((t) => {
    localStorage.setItem('moment-token', t)
  }, token)

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => httpErrors.push(`goto: ${e.message}`))
  await page.waitForSelector('textarea[placeholder*="Markdown"]', { timeout: 15000 }).catch(() => httpErrors.push('发布框未出现'))

  // 打开位置扩展
  await page.locator('button[title="更多"]').click().catch((e) => httpErrors.push(`更多: ${e.message}`))
  await page.waitForTimeout(400)
  await page.locator('button:has-text("位置")').first().click().catch((e) => httpErrors.push(`位置: ${e.message}`))
  await page.waitForTimeout(4000)

  const tileState = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.leaflet-tile'))
    return {
      hasLeaflet: !!document.querySelector('.leaflet-container'),
      tileCount: imgs.length,
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      srcs: imgs.slice(0, 3).map((i) => i.getAttribute('src')),
    }
  })

  console.log('===== HTTP >=400 =====')
  console.log(httpErrors.join('\n'))
  console.log('===== TILE STATE =====')
  console.log(JSON.stringify(tileState, null, 2))

  await browser.close()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
