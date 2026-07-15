# Editing carringtonbrown.com

Everything you see on the site lives in **one file**: `index.html`.
Photos live in **`assets/`**.

## To make a change and publish it

1. Edit `index.html` (or drop a new photo into `assets/`).
2. From this folder, run:

   ```bash
   ./deploy.sh "short note about what changed"
   ```

That's it. The script commits, pushes to GitHub, tells Render to rebuild, and
waits until the new version is actually **live** at https://carringtonbrown.com.

## Where things are in index.html

| Section on the site      | Search in index.html for |
| ------------------------ | ------------------------ |
| Credits / artist cards   | `credit-card`            |
| Key Facts (continents…)  | `KEY FACTS`              |
| Bio                      | `section-title`          |
| Endorsements             | `Endorsements`           |

Artist credit cards follow this pattern — copy one to add a new artist:

```html
<div class="credit-card reveal">
    <div class="credit-card-img-wrap">
        <img class="credit-card-img" src="/assets/NAME.jpg" alt="NAME">
    </div>
    <div class="credit-card-body">
        <span class="credit-role">Musical Director</span>
        <h3 class="credit-artist">NAME</h3>
        <p class="credit-detail">One or two sentences.</p>
        <p class="credit-year">2026 &ndash; Present</p>
    </div>
</div>
```

## Hosting facts (for reference)

- **Host:** Render **static site** `carrington-world`
  (ID `srv-d6rs9f7fte5s73esq5m0`) — serves this repo's files directly.
- **Repo:** github.com/carringtonb09-cyber/Carrington-world (branch `main`).
- **Domain:** carringtonbrown.com → Render.
- Render's auto-deploy webhook is flaky, which is why `deploy.sh` triggers the
  deploy through the API instead of relying on the push alone.

## Note: `server.js` / `package.json`

These are leftovers from an earlier Node setup that the **live site does not
use** (it's a static site). They're harmless but not needed for the website.
The analytics dashboard in `server.js` is separate.
