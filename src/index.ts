import type { Page } from 'puppeteer';
import puppeteer = require('puppeteer');
import { Engine } from './engine.js';
import { Game } from './game.js';

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
  return await puppeteer.launch({
    ignoreHTTPSErrors: true,
    // headless: true,
    headless: false,
    devtools: true,
    args,
  });
}

async function gotoCasualBullet(page: Page) {
  const siteUrl = 'https://lichess.org/';
  await page.goto(siteUrl);

  const mainTab = await page.$('div.tabs-horiz > span:nth-child(1)');
  if (!mainTab) {
    throw new Error('main Tab locator not found.');
  }
  await mainTab.tap();

  await page.waitForTimeout(100);

  const gameTab = await page.$('div[data-id="1+0"]');
  if (!gameTab) {
    throw new Error('game Tab locator not found.');
  }
  await gameTab.tap();
}

async function gotoTestPage(page: Page) {
  const siteUrl = 'http://0.0.0.0:4021/lichess_bullet.html';
  await page.goto(siteUrl);
}

async function gotoCasualGame(page: Page) {
  const siteUrl = 'https://lichess.org/fp6gwNVZ';
  await page.goto(siteUrl);

  const joinButton = await page.$('button.text.button.button-fat');
  if (joinButton) {
    await joinButton.tap();
  }
}

async function main() {
  const browser = await getBrowser();
  const page = (await browser.pages())[0];
  await gotoCasualGame(page);
  // await gotoTestPage(page);
  // await gotoCasualBullet(page)
  const game = new Game(page, 10, 10);
  const engine = new Engine(game);
  await engine.initEngine();
}

main().catch(function (error) {
  console.log(error);
});
