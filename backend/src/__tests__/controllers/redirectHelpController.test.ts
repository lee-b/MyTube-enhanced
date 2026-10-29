import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  buildRedirectorHelpHtml,
  buildRedirectorRulesJson,
  getRedirectorHelp,
} from "../../controllers/redirectHelpController";

const app = express();
app.get("/from/help", getRedirectorHelp);

const extractRulesJson = (html: string): string => {
  const match = html.match(
    /<script id="redirector-rules" type="application\/json">([\s\S]*?)<\/script>/
  );
  expect(match).toBeTruthy();
  return match![1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
};

describe("buildRedirectorRulesJson", () => {
  it("emits a Redirector-importable array of rules", () => {
    const rules = JSON.parse(buildRedirectorRulesJson());
    expect(rules).toHaveLength(4);
    const froms = rules.map((rule: { from: string }) => rule.from);
    expect(new Set(froms).size).toBe(froms.length);
    for (const rule of rules) {
      expect(rule.to).toContain("__ORIGIN__/from/youtube/");
      expect(rule.name).toContain("MyTube:");
      // Video rules capture the 11-char video id; the channel rule captures
      // one of YouTube's channel path shapes.
      if (rule.to.endsWith("/from/youtube/video/$1")) {
        expect(rule.from).toContain("[A-Za-z0-9_-]{11}");
      } else {
        expect(rule.from).toContain("channel/[^/?#]+|c/[^/?#]+|@[^/?#]+)");
      }
    }
  });

  it("covers watch pages, shorts/live, youtu.be, and channels", () => {
    const rules = JSON.parse(buildRedirectorRulesJson());
    expect(rules.map((rule: { name: string }) => rule.name)).toEqual([
      "MyTube: YouTube watch pages",
      "MyTube: YouTube shorts and live",
      "MyTube: youtu.be short links",
      "MyTube: YouTube channels",
    ]);
  });
});

describe("getRedirectorHelp", () => {
  const fetchHelp = async () => {
    const response = await request(app).get("/from/help");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    return response.text;
  };

  it("links the Redirector project without assuming a single browser store", async () => {
    const html = await fetchHelp();
    expect(html).toContain("https://github.com/rxliuli/redirector");
    expect(html).toContain("chromewebstore.google.com");
    expect(html).toContain("microsoftedge.microsoft.com");
    expect(html).toContain("addons.mozilla.org");
    expect(html).toContain("apps.apple.com");
  });

  it("renders every rule field for copy-paste", async () => {
    const html = await fetchHelp();
    expect(html).toContain("/from/youtube/video/$1");
    expect(html).toContain("/from/youtube/channel/$1");
    expect(html).toContain("watch\\?.*?v=([A-Za-z0-9_-]{11})");
    expect(html).toContain("channel/[^/?#]+|c/[^/?#]+|@[^/?#]+).*$");
  });

  it("embeds an importable rules JSON payload", async () => {
    const html = await fetchHelp();
    const rules = JSON.parse(extractRulesJson(html));
    expect(rules).toHaveLength(4);
  });

  it("fills rule targets from the browser's own origin at runtime", async () => {
    const html = await fetchHelp();
    // The static markup keeps the __ORIGIN__ placeholder (so the page never
    // hardcodes a host), and the inline script swaps in location.origin.
    expect(html).toContain("__ORIGIN__");
    expect(html).toContain("location.origin");
  });

  it("builds a self-contained HTML document", () => {
    const html = buildRedirectorHelpHtml();
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("</html>");
    expect(html).not.toMatch(/https?:\/\/[^\s"<>]*localhost/);
  });
});
