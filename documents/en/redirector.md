# Browser Redirector Takeover

MyTube can "take over" youtube.com navigation for content it already has
locally. Browser extensions like [Redirector](https://github.com/rxliuli/redirector)
([store page](https://store.rxliuli.com/extensions/redirector/)) match URLs you
visit and rewrite them; MyTube provides the matching targets and resolves them
against your library.

## How it works

The backend serves these redirect targets (platform-scoped so other platforms
can add their own `/from/<platform>/...` targets later). For the extension
itself, see the [Redirector project page](https://github.com/rxliuli/redirector);
it is available for [Chrome](https://chromewebstore.google.com/detail/redirector/lioaeidejmlpffbndjhaameocfldlhin),
[Edge](https://microsoftedge.microsoft.com/addons/detail/redirector/jhdjcofnjfeljeekjklhgfmfocfgibmm),
[Firefox](https://addons.mozilla.org/en-US/firefox/addon/redirector-url/), and
[Safari](https://apps.apple.com/cn/app/url-redirector/id6743197230):

| Path | Resolves against | Redirects to (local match) | Redirects to (no match) |
| --- | --- | --- | --- |
| `GET /from/youtube/video/<id>` | the library's download-tracking rows (`source_video_id`) | `/video/<local-id>` (the local player) | `https://www.youtube.com/watch?v=<id>` |
| `GET /from/youtube/channel/<path>` | the `channel_url`/author of library videos | `/author/<author>` (the local author page) | `https://www.youtube.com/<path>` |

`<id>` is the 11-character YouTube video id, and `<path>` is the channel part
of a YouTube URL (`channel/UC...`, legacy `c/<name>`, or `@<handle>`).

Notes:

- The takeover is **non-destructive**: when MyTube cannot serve the content
  locally, the browser is simply sent to the original YouTube URL. Nothing is
  lost by enabling it.
- The local player page is only served when the video is actually present and
  visible to the caller (a "deleted" download-tracking row, or a hidden video
  for a visitor, falls back to YouTube).
- Channel resolution relies on `channel_url`, which MyTube persists per video.
  A channel therefore resolves locally once at least one of its videos is in
  the library. `@<handle>` paths are matched against author display names,
  which usually equal the handle.
- These routes answer with plain 302 navigations and are not gated behind
  login; visibility scoping still applies to what they may reveal.

## Setting up Redirector

Open the Redirector options page and add rules like the following, replacing
`http://mintbox.lan:5551` with your MyTube base URL:

- **Video watch pages**
  - Match URL: `^https://(?:www\.)?youtube\.com/watch\?.*?v=([A-Za-z0-9_-]{11}).*$`
  - Redirect To: `http://mintbox.lan:5551/from/youtube/video/$1`
- **Shorts and live**
  - Match URL: `^https://(?:www\.)?youtube\.com/(?:shorts|live)/([A-Za-z0-9_-]{11}).*$`
  - Redirect To: `http://mintbox.lan:5551/from/youtube/video/$1`
- **youtu.be short links**
  - Match URL: `^https://youtu\.be/([A-Za-z0-9_-]{11}).*$`
  - Redirect To: `http://mintbox.lan:5551/from/youtube/video/$1`
- **Channels**
  - Match URL: `^https://(?:www\.)?youtube\.com/(channel/[^/?#]+|c/[^/?#]+|@[^/?#]+).*$`
  - Redirect To: `http://mintbox.lan:5551/from/youtube/channel/$1`

Playlist pages are intentionally not intercepted.

## Help page

MyTube also serves a ready-made guide at `/from/help` on your instance. The
page fills in your instance's base URL automatically (so the rules you copy
already point at the right host) and offers a Redirector-importable rules JSON
for one-click setup.
