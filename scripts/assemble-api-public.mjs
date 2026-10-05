// Assemble the built SPAs into the API's public dir so a single process serves the whole app.
//
// apps/api/src/index.ts reads apps/api/public/{dashboard,viewer}/index.html at startup and serves
// /dashboard and /v from them. This mirrors what the Dockerfile used to do inline; keeping it in
// one script means the Docker build and the Render build cannot drift apart.
import { cpSync, rmSync } from 'node:fs';

const copies = [
  ['apps/web/dist', 'apps/api/public/dashboard'],
  ['apps/viewer/dist', 'apps/api/public/viewer'],
];

for (const [from, to] of copies) {
  // cpSync throws if `from` is missing, which is what we want: no build, no silent empty dir.
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`assembled ${to} <- ${from}`);
}
