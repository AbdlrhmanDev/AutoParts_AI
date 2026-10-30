import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_EXECUTABLE_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('docs/images');
await fs.mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--window-size=1600,1000'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 30_000 });
  await page.screenshot({ path: path.join(outputDir, 'dashboard.jpg'), type: 'jpeg', quality: 88, fullPage: true });

  const clickedExample = await page.evaluate(() => {
    const label = 'أبغى فحمات أمامية لأكسنت 2020';
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes(label));
    button?.click();
    return Boolean(button);
  });
  if (!clickedExample) throw new Error('Dashboard example request was not found');

  await page.waitForFunction(
    () => document.body.textContent?.includes('البحث عن القطع') || document.body.textContent?.includes('Finding parts'),
    { timeout: 45_000 },
  ).catch(() => undefined);
  await page.waitForFunction(
    () => ![...document.querySelectorAll('button')].some(button => /إيقاف|Stop/.test(button.textContent ?? '')),
    { timeout: 120_000 },
  );
  await new Promise(resolve => setTimeout(resolve, 700));
  await page.screenshot({ path: path.join(outputDir, 'agent-results.jpg'), type: 'jpeg', quality: 88, fullPage: true });

  const clickedGraph = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(item => /مسار الوكيل|Agent path/i.test(item.textContent ?? ''));
    button?.click();
    return Boolean(button);
  });
  if (!clickedGraph) throw new Error('Agent workflow navigation was not found');
  await page.waitForFunction(
    () => /عرض المطوّر|Developer view/i.test(document.body.textContent ?? ''),
    { timeout: 15_000 },
  );
  const openedDeveloperView = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(item => /عرض المطوّر|Developer view/i.test(item.textContent ?? ''));
    button?.click();
    return Boolean(button);
  });
  if (!openedDeveloperView) throw new Error('Developer workflow view was not found');
  await page.waitForSelector('.react-flow', { timeout: 15_000 });
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.screenshot({ path: path.join(outputDir, 'agent-workflow.jpg'), type: 'jpeg', quality: 88, fullPage: true });

  console.log(`README screenshots written to ${outputDir}`);
} finally {
  await browser.close();
}
