import fs = require("fs");
import os = require("os");

import { Page } from "puppeteer/lib/types";

const BASE_URL = "https://www.ricardo.ch";

const BASE_CATEGORY_URL = "/de/s/";

type AuctionItem = {
  link: string;
  name: string;
  gebotePrice: number;
  sofortPrice: number;
};

type NextPageParams = {
  nextPage: number;
  lastPageNumber: number;
};

const scrape = async (page: Page, pageNumber = 1): Promise<NextPageParams> => {
  await navigatePage(page, pageNumber);
  await scrapeAuctions(page);

  const lastPageNumber = await getLastPageNumber(page);

  return { lastPageNumber, nextPage: pageNumber + 1 };
};

const navigatePage = async (
  page: Page,
  pageNumber = 1,
  category = BASE_CATEGORY_URL
): Promise<void> => {
  const pageUrl = BASE_URL + category;

  const searchParams = new URLSearchParams({
    offer_type: "fixed_price",
    listing_type: "start_1",
    sort: "close_to_end",
    page: pageNumber.toString(),
  });

  const pageUrlSearchParams = [pageUrl, searchParams].join("?");

  await page.goto(pageUrlSearchParams, { waitUntil: "networkidle0" });
};

const scrapeAuctions = async (page: Page): Promise<void> => {
  await page.waitForSelector("a.MuiGrid-item");

  const items = await page.evaluate(() =>
    [...document.querySelectorAll("a.MuiGrid-item")].map((item) => {
      const elem = item as HTMLAnchorElement;

      let auctionName = undefined;

      [...elem.querySelectorAll('[class^="jss"] > p')].forEach((textElem) => {
        const textValue = textElem?.textContent ?? "";

        if (/Neu.eingestellt/.test(textValue)) {
          return;
        }

        auctionName = textValue;
      });

      let gebotePrice = undefined;
      let sofortPrice = undefined;

      [...elem.querySelectorAll(".MuiBox-root > p")].forEach((textElem) => {
        const textValue = textElem?.textContent ?? "";

        if (/\d+.Gebote/.test(textValue)) {
          gebotePrice = parseFloat(
            textElem.parentElement.children[1].textContent
          );
        }

        if (/Sofort kaufen/.test(textValue)) {
          sofortPrice = parseFloat(
            textElem.parentElement.children[1].textContent
          );
        }
      });

      return {
        link: elem.href,
        name: auctionName,
        gebotePrice,
        sofortPrice,
      };
    })
  );

  items.forEach((item: AuctionItem) => {
    const isProfitable = isAuctionProfitable(
      item.gebotePrice,
      item.sofortPrice
    );

    if (isProfitable) {
      writeAuction(item);
    }
  });
};

const getLastPageNumber = async (page: Page): Promise<number> => {
  await page.waitForSelector(".MuiFlatPagination-root");

  return await page.evaluate(() => {
    const elem = document.querySelector(".MuiFlatPagination-root");
    return parseInt([...elem.children].slice(-2)?.[0]?.textContent ?? "-");
  });
};

const isAuctionProfitable = (
  gebotePrice: number,
  sofortPrice: number
): boolean => {
  if (!gebotePrice || !sofortPrice) {
    return false;
  }

  const priceMultiplier = sofortPrice / gebotePrice;

  if (gebotePrice >= 100 && priceMultiplier >= 3) {
    return true;
  }

  if (gebotePrice >= 50 && priceMultiplier >= 4) {
    return true;
  }

  if (gebotePrice >= 25 && priceMultiplier >= 5) {
    return true;
  }

  if (gebotePrice >= 10 && priceMultiplier >= 10) {
    return true;
  }

  if (priceMultiplier >= 20) {
    return true;
  }

  return false;
};

const writeAuction = (item: AuctionItem): void => {
  if (!fs.existsSync("./auctions.csv")) {
    const text = `Name\tGebote\tSofort\tLink` + os.EOL;

    fs.writeFileSync("./auctions.csv", text, {
      encoding: "utf-8",
      flag: "a",
    });
  }

  const text =
    `${item.name}\t${item.gebotePrice}\t${item.sofortPrice}\t${item.link}` +
    os.EOL;

  fs.writeFileSync("./auctions.csv", text, {
    encoding: "utf-8",
    flag: "a",
  });
};

export default scrape;
