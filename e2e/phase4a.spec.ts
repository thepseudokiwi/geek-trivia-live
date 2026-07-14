import { test, expect } from "@playwright/test";
test("D20 selector and Event Die use one authoritative persisted result", async ({
  browser,
  request,
}) => {
  const copy = await request.post("/api/episodes/DEMO-EP-LOCKED/duplicate"),
    episode = await copy.json(),
    id = episode.id;
  await request.post(`/api/episodes/${id}/lock`);
  await request.post(`/api/episodes/${id}/start`);
  await request.post(`/api/live/${id}/participants`, {
    data: { displayName: "D20 Team" },
  });
  await request.put(`/api/episodes/${id}/d20`, {
    data: { mode: "question_selector", animationDurationMs: 100 },
  });
  const host = await browser.newPage(),
    audience = await browser.newPage();
  await host.goto(`/#host/${id}`);
  await audience.goto(`/#audience/${id}`);
  await expect(host.getByRole("heading", { name: "D20 System" })).toBeVisible();
  await host.getByRole("button", { name: "Roll D20" }).click();
  await expect(audience.locator(".d20-public")).toBeVisible();
  await expect(audience.getByText("19", { exact: true })).toBeVisible();
  await expect(host.getByText("Selected:", { exact: true })).toBeVisible();
  await expect(audience.locator(".d20-public")).not.toContainText("Sample ");
  await host.getByRole("button", { name: "Acknowledge" }).click();
  await expect(audience.locator(".audience-board")).toBeVisible();
  await host.getByRole("button", { name: "Show question" }).click();
  await expect(audience.locator(".broadcast-question h2")).toBeVisible();
  await host.getByRole("button", { name: "Complete", exact: true }).click();
  await request.put(`/api/episodes/${id}/d20`, {
    data: { mode: "event_die", animationDurationMs: 100 },
  });
  await host.reload();
  const square = host.locator(".live-square:not([disabled])").first();
  await square.click();
  await host.getByRole("button", { name: "Roll D20" }).click();
  await expect(audience.getByText("Double XP", { exact: true })).toBeVisible();
  await expect(audience.getByText("19", { exact: true })).toBeVisible();
  await host.getByRole("button", { name: "Apply modifier" }).click();
  await host.getByRole("button", { name: "Show question" }).click();
  const before = Number(
    await audience
      .locator("footer div")
      .filter({ hasText: "D20 Team" })
      .locator("strong")
      .textContent(),
  );
  const value = Number(
    (await host.locator(".private-question .eyebrow").textContent())?.match(
      /(\d+) XP/,
    )?.[1],
  );
  await host.getByRole("button", { name: "Award" }).click();
  await expect
    .poll(async () =>
      Number(
        await audience
          .locator("footer div")
          .filter({ hasText: "D20 Team" })
          .locator("strong")
          .textContent(),
      ),
    )
    .toBe(before + value * 2);
  host.once("dialog", (d) => d.accept());
  await host.getByRole("button", { name: "Undo: score change" }).click();
  await expect
    .poll(async () =>
      Number(
        await audience
          .locator("footer div")
          .filter({ hasText: "D20 Team" })
          .locator("strong")
          .textContent(),
      ),
    )
    .toBe(before);
  host.once("dialog", (d) => d.accept());
  await host.getByRole("button", { name: "Undo applied D20" }).click();
  await expect(host.getByRole("button", { name: "Roll D20" })).toBeEnabled();
});
