import { Page, launch } from 'puppeteer';

async function getBrowser() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--incognito',
    '--enable-features=NetworkService',
    '--ignore-certificate-errors',
    '--ignore-certificate-errors-spki-list',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=3840x2160',
    '--unlimited-storage',
    '--full-memory-crash-report',
  ];
  const browser = await launch({
    ignoreHTTPSErrors: true,
    // headless: true,
    headless: false,
    // devtools: true,
    args,
  });
  return browser;
}

async function gotoCasualBullet(page: Page) {
  try {
    const siteUrl = 'https://lichess.org/';
    await page.goto(siteUrl);

    const mainTab = await page.$('div.tabs-horiz > span:nth-child(1)');
    await mainTab?.tap();

    await page.waitForTimeout(100);

    const elementHandle = await page.$('div[data-id="1+0"]');
    await elementHandle?.tap();
  } catch (error: any) {
    console.log(error);
  }
}

async function gotoTestPage(page: Page) {
  const siteUrl = 'http://0.0.0.0:4021/lichess_bullet.html';
  await page.goto(siteUrl);
}

async function main() {
  const browser = await getBrowser();
  const page = (await browser.pages())[0];
  await gotoTestPage(page);
}

main().catch(function (error) {
  console.log(error);
});
