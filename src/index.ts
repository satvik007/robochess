import type { ElementHandle, Page } from 'puppeteer';
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

  await page.waitForSelector('cg-container');
}

async function gotoCasualGame(page: Page) {
  const siteUrl = 'https://lichess.org/fp6gwNVZ';
  await page.goto(siteUrl);

  const joinButton = await page.$('button.text.button.button-fat');
  if (joinButton) {
    await joinButton.tap();
  }
}

async function gotoCasualAgainstCompie(
  page: Page,
  level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  color: 'white' | 'black' | 'random'
) {
  const siteUrl = 'https://lichess.org/';
  await page.goto(siteUrl);

  const playWithCompie = await page.$('a.button.button-metal.config_ai');
  if (!playWithCompie) {
    throw new Error('play with computer button not found');
  }
  await playWithCompie.tap();

  await page.waitForSelector(`label[for='sf_level_${level}']`);

  const selectElement = (await page.evaluateHandle((level) => {
    const element = document.querySelector(`label[for='sf_level_${level}']`);
    if (!element?.parentElement) {
      throw new Error('select level not found.');
    }
    return element.parentElement;
  }, level)) as ElementHandle;
  await selectElement.tap();

  const submitColor = await page.$(`button[value='${color}']`);
  if (!submitColor) {
    throw new Error('submit Color not found.');
  }
  await submitColor.tap();

  await page.waitForSelector('cg-container');
}

async function main() {
  const browser = await getBrowser();
  const page = (await browser.pages())[0];
  // await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.2.1.min.js'});
  // await gotoCasualAgainstCompie(page, 2, 'random');
  await gotoCasualBullet(page);
  const game = new Game(page, 300, 3);

  const engine = new Engine();
  const { playerColor } = await game.initArgs();
  await engine.initEngine(300, 3, playerColor);

  console.log('playerColor:', playerColor);
  console.log('gameTurn:', game.turn);

  while (!game.gameOver) {
    if (game.turn === playerColor) {
      engine.turn = playerColor;
      console.log(game.gameMove);
      engine.prepareMove();
      while (!engine.engineMove) {
        await new Promise((r) => setTimeout(r, 10));
      }
      const engineMove = engine.engineMove;
      engine.engineMove = null;
      console.log('ENGINE_MOVE:', engineMove);
      engine.history.push(engineMove);
      game.history.push(engineMove);
      engine.turn = playerColor === 'white' ? 'black' : 'white';
      await game.move(engineMove);
    } else {
      await new Promise(r => setTimeout(r, 100));
      game.turn = playerColor === 'white' ? 'black' : 'white';
      while (!game.gameMove) {
        await game.getGameMove();
      }
      console.log('GAME_MOVE:', game.gameMove);
      game.history.push(game.gameMove);
      engine.history.push(game.gameMove);
      game.turn = playerColor;
    }
  }
}

main().catch(function (error) {
  console.log(error);
});
