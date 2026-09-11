# Eidolon website

The standalone public website for **https://eidolonrealms.com**. All Play links go to **https://play.eidolonrealms.com**. The footer credits and links to **https://mendola.tech**.

## Cloudflare Pages

Connect this Git repository to a new **Pages** project with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Framework preset | None |
| Root directory | `website` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `24` (also set in `.nvmrc`) |

The output directory is relative to the root directory: the resulting repository path is **`website/dist`**. No environment variables, game-server secrets, or runtime functions are required. The website has no third-party dependencies.

After the first deployment, add `eidolonrealms.com` under the Pages project's **Custom domains** and complete Cloudflare's domain setup. Keep `play.eidolonrealms.com` pointed at the game deployment. If limiting Pages build watch paths, include both `website/*` and `src/analytics/GoogleAnalytics.js` so changes to the shared tag also rebuild the website.

Cloudflare reference: [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Local development

```sh
cd website
npm ci
npm run dev
```

Open `http://127.0.0.1:4321`. Refresh after editing files in `src/`. To serve the production output:

```sh
npm run build
npm run preview
```

From the repository root, the build can also be run with `npm --prefix website run build`. The build copies only the public `src/` files into `dist/`, which is ignored by Git. The existing game frontend and Go backend have independent tooling and are not part of this build.

## Content and assets

- `src/index.html`: page content, navigation, native FAQ disclosures, and search metadata.
- `src/styles.css`: responsive design, focus states, and reduced-motion support.
- `src/assets/gameplay*.webp`: optimized, responsive copies of the actual town gameplay capture in `docs/media/gameplay-overworld.png`.
- `src/assets/realms-hero*.webp`: responsive concept art; the original is retained in `artwork/realms-hero.png` outside the public build.
- `src/_headers`: Cloudflare Pages security and asset-cache headers.
- `src/404.html`, `robots.txt`, and `sitemap.xml`: static hosting and discovery support.

The site uses system fonts, lightweight GA4 analytics, and no remote visual assets. The inline JSON-LD script is structured data only. The shared analytics loader in `../src/analytics/GoogleAnalytics.js` is copied into the public build; the complete repository checkout must be present. See [analytics events and reporting setup](../docs/ANALYTICS.md).

## Technical SEO

Run `npm run build` then `npm run check:seo`. CI runs the same checks for website changes. The check covers the primary heading, heading order, unique metadata, canonical URL, connected JSON-LD entities, local assets, anchors, image dimensions, sitemap and robots directives.

The page includes `WebSite`, `WebPage`, `VideoGame`, and `Person` schema based on visible content. There are no invented ratings, reviews, prices, or release dates. Valid Schema.org markup does not by itself guarantee Google rich-result eligibility. The native FAQ stays visible and accessible without claiming an FAQ rich result.

The `/index` and `/index.html` aliases redirect to `/` on Pages. Cloudflare owns HTTP-to-HTTPS and custom-domain behavior; the local preview is not a DNS/TLS or CDN test. After deploying, check the live canonical domain, redirect behavior, security headers, indexability, and a genuine 404 response, then submit `https://eidolonrealms.com/sitemap.xml` in Google Search Console. Search Console ownership verification requires the site owner's account.

Audit the production build with Lighthouse (keep the preview running in another terminal):

```sh
npm run preview
# In another terminal:
npx --yes lighthouse@13.4.1 http://127.0.0.1:4321/ --only-categories=seo --chrome-flags="--headless=new"
```

Lighthouse's SEO score describes its automated checks; it does not measure search rankings, rich-result eligibility, or every technical SEO requirement. Repeat the audit against `https://eidolonrealms.com/` after deployment.

References: [Google title guidance](https://developers.google.com/search/docs/appearance/title-link), [site name structured data](https://developers.google.com/search/docs/appearance/site-names), [Schema.org VideoGame](https://schema.org/VideoGame).
