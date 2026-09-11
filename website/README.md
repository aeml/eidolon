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

After the first deployment, add `eidolonrealms.com` under the Pages project's **Custom domains** and complete Cloudflare's domain setup. Keep `play.eidolonrealms.com` pointed at the game deployment. Optionally limit Pages build watch paths to `website/*` so unrelated game changes do not rebuild this site.

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
- `src/assets/gameplay.png`: actual town gameplay capture copied from `docs/media/gameplay-overworld.png`.
- `src/assets/realms-hero.png`: original generated atmospheric concept art; labeled as concept art on the page, not presented as gameplay.
- `src/_headers`: Cloudflare Pages security and asset-cache headers.
- `src/404.html`, `robots.txt`, and `sitemap.xml`: static hosting and discovery support.

The site uses system fonts and no client JavaScript, analytics, cookies, or remote asset services.
