import { expect, test } from "@playwright/test";
import { createExternalRequestGuard } from "../src/lib/network-guard";

test("typing controls and active test stay local without forced scrolling", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required.");
  const networkGuard = createExternalRequestGuard(baseURL);
  page.on("request", (request) => networkGuard.inspect(request.url()));

  await page.goto("/");
  await page.getByRole("button", { name: "15s" }).click();
  await page.getByLabel("Font size").selectOption("4");
  await page.getByLabel("Reading area").selectOption("0");

  const passage = page.getByLabel("Text to type");
  const manualScrollPosition = await passage.evaluate((element) => {
    element.scrollTop = Math.max(
      1,
      Math.floor((element.scrollHeight - element.clientHeight) / 2),
    );
    return element.scrollTop;
  });
  expect(manualScrollPosition).toBeGreaterThan(0);
  const input = page.locator("#typing-input");
  await input.fill("The ");

  await expect(page.getByText("Time left")).toBeVisible();
  await expect(input).toHaveCSS("font-size", "28px");
  await expect(passage).toHaveClass(/passage-height-0/u);
  expect(await passage.evaluate((element) => element.scrollTop)).toBe(
    manualScrollPosition,
  );
  networkGuard.assertNoExternalRequests();
});
