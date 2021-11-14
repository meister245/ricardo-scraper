import puppeteer from "puppeteer-extra";
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import scrape from "./scraper";

puppeteer.use(RecaptchaPlugin()).use(StealthPlugin());

puppeteer.launch({ headless: false }).then(async (browser) => {
  const page = await browser.newPage();

  await page.setViewport({
    width: 1600,
    height: 800,
  });

  try {
    let { lastPageNumber, nextPage: pageNumber } = await scrape(page);

    while (pageNumber <= lastPageNumber) {
      const { lastPageNumber: updatedLastPage, nextPage } = await scrape(
        page,
        pageNumber
      );

      pageNumber = nextPage;
      lastPageNumber = updatedLastPage;
    }
  } catch (error) {
    console.log(error);
  } finally {
    await browser.close();
  }
});
