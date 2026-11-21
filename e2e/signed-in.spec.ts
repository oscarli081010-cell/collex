import { test } from "@playwright/test";

// Placeholders for the flows that need a signed-in account. They are skipped until there is a dedicated test
// account (an email and password in E2E_EMAIL / E2E_PASSWORD) on a test Supabase project, never the live one.
// Do not point these at production data: they create and change listings, applications and committees.

test.describe("signed in (needs a test account)", () => {
  test.skip(true, "needs a test account; see the comment at the top of this file");

  test("list a conference", async () => { /* log in, open /list, fill the form, submit, see it in /listings as In review */ });
  test("apply to a conference", async () => { /* open a conference that takes applications, apply as a delegate, see Sent */ });
  test("allocate delegates", async () => { /* as an organiser: accept an application, allocate by preference, check the committee and country */ });
  test("run a committee", async () => { /* open /chambers, start a Standard committee, take a roll call, open a speakers' list */ });
});
