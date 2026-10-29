import { Request, Response } from "express";

/**
 * Help page for the browser-redirector takeover targets.
 *
 * Served at GET /from/help. The page documents the Redirector project (with
 * install links for every browser it ships on, not just one store) and lists
 * paste-ready rules for this instance. Rule targets are filled in by the
 * browser from its own location.origin, so the guide stays correct no matter
 * which host/port or reverse-proxy path a visitor is using to reach MyTube.
 */

interface RedirectorRule {
  name: string;
  from: string;
  to: string;
  testUrl: string;
}

// `__ORIGIN__` is replaced with the browser's location.origin at runtime.
// Captures line up with documents/en/redirector.md.
const REDIRECTOR_RULES: RedirectorRule[] = [
  {
    name: "MyTube: YouTube watch pages",
    from: "^(?:https?:)?//(?:www\\.)?youtube\\.com/watch\\?.*?v=([A-Za-z0-9_-]{11}).*$",
    to: "__ORIGIN__/from/youtube/video/$1",
    testUrl: "https://www.youtube.com/watch?v=6SxEj1cujQE",
  },
  {
    name: "MyTube: YouTube shorts and live",
    from: "^(?:https?:)?//(?:www\\.)?youtube\\.com/(?:shorts|live)/([A-Za-z0-9_-]{11}).*$",
    to: "__ORIGIN__/from/youtube/video/$1",
    testUrl: "https://www.youtube.com/shorts/6SxEj1cujQE",
  },
  {
    name: "MyTube: youtu.be short links",
    from: "^(?:https?:)?//youtu\\.be/([A-Za-z0-9_-]{11}).*$",
    to: "__ORIGIN__/from/youtube/video/$1",
    testUrl: "https://youtu.be/6SxEj1cujQE",
  },
  {
    name: "MyTube: YouTube channels",
    from: "^(?:https?:)?//(?:www\\.)?youtube\\.com/(channel/[^/?#]+|c/[^/?#]+|@[^/?#]+).*$",
    to: "__ORIGIN__/from/youtube/channel/$1",
    testUrl: "https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ",
  },
];

const REDIRECTOR_PROJECT_URL = "https://github.com/rxliuli/redirector";
// Redirector ships on all major stores; link them all rather than assuming
// which browser the visitor came with.
const REDIRECTOR_INSTALL_LINKS: Array<{ label: string; href: string }> = [
  {
    label: "Chrome",
    href: "https://chromewebstore.google.com/detail/redirector/lioaeidejmlpffbndjhaameocfldlhin",
  },
  {
    label: "Edge",
    href: "https://microsoftedge.microsoft.com/addons/detail/redirector/jhdjcofnjfeljeekjklhgfmfocfgibmm",
  },
  {
    label: "Firefox",
    href: "https://addons.mozilla.org/en-US/firefox/addon/redirector-url/",
  },
  {
    label: "Safari",
    href: "https://apps.apple.com/cn/app/url-redirector/id6743197230",
  },
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildRedirectorRulesJson = (): string =>
  JSON.stringify(
    REDIRECTOR_RULES.map(({ name, from, to, testUrl }) => ({
      name,
      from,
      to,
      testUrl,
    })),
    null,
    2
  );

const renderRuleRow = (rule: RedirectorRule, index: number): string => `
      <tr>
        <td>${escapeHtml(rule.name)}</td>
        <td><code class="rule-field rule-from">${escapeHtml(rule.from)}</code></td>
        <td><code class="rule-field rule-to" data-origin-fill>${escapeHtml(rule.to)}</code></td>
        <td><button type="button" class="copy" data-rule-index="${index}">Copy</button></td>
      </tr>`;

export const buildRedirectorHelpHtml = (): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MyTube — Browser Redirector Takeover</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; padding: 0 1rem; color: #ddd; background: #181818; }
    a { color: #93c5fd; }
    h1 { font-size: 1.5rem; } h2 { font-size: 1.15rem; margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; vertical-align: top; padding: 0.5rem; border: 1px solid #444; }
    code.rule-field { display: block; white-space: pre-wrap; word-break: break-all; font-size: 0.8rem; color: #a5d6a7; }
    button.copy { cursor: pointer; }
    .install-links { list-style: none; padding: 0; display: flex; gap: 1rem; flex-wrap: wrap; }
    .muted { color: #9e9e9e; }
  </style>
</head>
<body>
  <h1>Browser Redirector Takeover</h1>
  <p>
    MyTube can take over youtube.com navigation for content it already has
    locally: when you visit a YouTube video or channel, a URL-redirector
    extension rewrites the address to this instance, which sends you to the
    local player or author page — or, when the content is not local, straight
    back to YouTube, so nothing is lost by enabling it.
  </p>
  <p>
    The extension used in this guide is
    <a href="${REDIRECTOR_PROJECT_URL}">Redirector</a> — a dynamic URL
    redirector available for all major browsers:
    <ul class="install-links">
      ${REDIRECTOR_INSTALL_LINKS.map(
        ({ label, href }) =>
          `<li><a href="${href}" rel="noopener noreferrer">${label}</a></li>`
      ).join("")}
    </ul>
  </p>

  <h2>Setup</h2>
  <ol>
    <li>
      Install Redirector for your browser from the links above, open its
      options page, and use its <em>Import</em> with the JSON below, or add
      the rules by hand with the table's per-field copy buttons.
    </li>
    <li>
      The <code>Redirect To</code> targets below point at
      <code data-origin-fill>__ORIGIN__</code> — this page fills that in with
      the address your browser is actually using for MyTube, so the rules work
      as-is behind any host, port, or proxy you browse this page with.
    </li>
    <li>
      Verify with Redirector's own <em>Test URL</em> box: pasting a YouTube
      watch link should resolve to <code>/from/youtube/video/&lt;id&gt;</code>
      on this instance.
    </li>
  </ol>

  <h2>Rules</h2>
  <table>
    <thead>
      <tr><th>Name</th><th>Match URL</th><th>Redirect To</th><th></th></tr>
    </thead>
    <tbody>
      ${REDIRECTOR_RULES.map((rule, index) => renderRuleRow(rule, index)).join("")}
    </tbody>
  </table>
  <p>
    <button type="button" id="copy-rules-json">Copy all rules as JSON</button>
    <span class="muted">— imports into Redirector's options page (Import under the rules menu).</span>
  </p>

  <h2>Notes</h2>
  <ul>
    <li>
      Playlist pages are intentionally not intercepted, and channels resolve
      locally only once at least one of their videos is in the library.
    </li>
    <li>
      See <a href="https://github.com/franklioxygen/MyTube/blob/master/documents/en/redirector.md">the project documentation</a>
      for the full endpoint reference.
    </li>
  </ul>

  <script id="redirector-rules" type="application/json">${escapeHtml(buildRedirectorRulesJson())}</script>
  <script>
    (function () {
      var origin = location.origin;
      document.querySelectorAll('[data-origin-fill]').forEach(function (el) {
        el.textContent = el.textContent.replace('__ORIGIN__', origin);
      });
      var copyText = function (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text);
        }
      };
      var rulesJson = document.getElementById('redirector-rules').textContent;
      var button = document.getElementById('copy-rules-json');
      if (button) {
        button.addEventListener('click', function () {
          copyText(JSON.stringify(JSON.parse(rulesJson).map(function (rule) {
            return { name: rule.name, from: rule.from, to: rule.to.replace('__ORIGIN__', origin), testUrl: rule.testUrl };
          }), null, 2));
        });
      }
      document.querySelectorAll('button.copy').forEach(function (button) {
        button.addEventListener('click', function () {
          var index = Number(button.getAttribute('data-rule-index'));
          var row = document.querySelectorAll('tbody tr')[index];
          var from = row.querySelector('.rule-from').textContent;
          var to = row.querySelector('.rule-to').textContent;
          copyText(from + '\\n' + to);
        });
      });
    })();
  </script>
</body>
</html>`;

export const getRedirectorHelp = (
  _req: Request,
  res: Response
): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildRedirectorHelpHtml());
};
