// Builds pack/superfit-master-pack.zip: everything needed to start a fresh
// Lovable (or any) project from this codebase, without touching other repos.
//   superfit-app/        the full Next.js app, exactly as committed (git archive)
//   core/                pure rules (no Next.js, no database) to drop into src/
//   supabase/schema.sql  every migration, in order
//   LOVABLE_PROMPT.md    the brief to paste into Lovable
// Run: npm run pack:lovable
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "pack");
const stage = path.join(out, "superfit-master-pack");
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

rmSync(out, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

// 1. The app, from git so no local data, secrets or build output sneak in.
const sha = sh("git rev-parse --short HEAD");
const dirty = sh("git status --porcelain");
if (dirty) console.warn("Note: uncommitted changes are NOT in the pack (it uses the last commit).");
sh(`git archive --format=tar --prefix=superfit-app/ HEAD | tar -x -C "${stage}"`);

// 2. core/: the pure rules and everything they import.
const ENTRIES = [
  "lib/membership/access.ts",
  "lib/membership/dates.ts",
  "lib/membership/codes.ts",
  "lib/membership/reminders.ts",
  "lib/membership/glofox.ts",
  "lib/performance/metrics.ts",
  "lib/expenses/rules.ts",
  "lib/staff/rules.ts",
  "lib/messages/segments.ts",
  "lib/leads/constants.ts",
  "lib/reports/analyze.ts",
  "lib/dashboard/catalog.ts",
  "lib/csv.ts",
  "lib/sales/qashier.ts",
  "lib/catalog/index.ts",
  "lib/catalog/validate.ts",
  "lib/nutrition.ts",
  "lib/pricing.ts",
  "lib/pos/ticket.ts",
  "lib/format.ts",
  "lib/payments/promptpay.ts",
  "components/admin/check-in/sounds.ts",
];
const FORBIDDEN = [/from "next/, /from "drizzle-orm/, /from "server-only"/, /from "@\/lib\/db/, /from "react"/];

function resolve(spec, from) {
  const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, "index.ts")]) if (existsSync(c) && !c.endsWith("/")) {
    try {
      readFileSync(c);
      return c;
    } catch {
      /* directory */
    }
  }
  throw new Error(`Can't resolve ${spec} from ${path.relative(root, from)}`);
}

const seen = new Set();
const queue = ENTRIES.map((e) => path.join(root, e));
for (const f of readdirSync(path.join(root, "content"))) queue.push(path.join(root, "content", f));
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  if (!/\.tsx?$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  const bad = FORBIDDEN.find((re) => re.test(src));
  if (bad) throw new Error(`${path.relative(root, file)} isn't portable (${bad}). Keep core files free of Next.js, React and the database.`);
  for (const m of src.matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']/g)) {
    const spec = m[1];
    if (spec.startsWith("@/") || spec.startsWith(".")) queue.push(resolve(spec, file));
  }
}
const coreFiles = [...seen].map((f) => path.relative(root, f)).sort();
for (const rel of coreFiles) cpSync(path.join(root, rel), path.join(stage, "core", rel));

// Unit tests that only need the core (no database).
const PURE_TESTS = ["membership.test.ts", "nutrition.test.ts", "format.test.ts", "payments.test.ts", "reminders.test.ts", "reports.test.ts"];
for (const t of PURE_TESTS) {
  const p = path.join(root, "tests/unit", t);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, "utf8");
  if (FORBIDDEN.some((re) => re.test(src))) continue;
  const deps = [...src.matchAll(/from\s+["'](@\/[^"']+)["']/g)].map((m) => path.relative(root, resolve(m[1], p)));
  if (!deps.every((d) => coreFiles.includes(d))) continue;
  cpSync(p, path.join(stage, "core/tests", t));
}

// 3. One SQL file for Supabase.
const migrations = readdirSync(path.join(root, "drizzle")).filter((f) => f.endsWith(".sql")).sort();
const sql = migrations
  .map((f) => `-- ${f}\n${readFileSync(path.join(root, "drizzle", f), "utf8").replace(/--> statement-breakpoint/g, "")}`)
  .join("\n\n");
mkdirSync(path.join(stage, "supabase"), { recursive: true });
writeFileSync(path.join(stage, "supabase/schema.sql"), `-- Superfit database, all migrations in order (${migrations.length}). Run once in the Supabase SQL editor.\n\n${sql}\n`);

// 4. Brief + readme.
const docs = (f) => readFileSync(path.join(root, "docs", f), "utf8");
const handoff = docs("ADMIN-PLAN.md");
const prompt = handoff.slice(handoff.indexOf("**Prompt starter for Lovable**")).split("\n---")[0];
writeFileSync(
  path.join(stage, "LOVABLE_PROMPT.md"),
  `# Paste into a NEW Lovable project

${prompt.replace("**Prompt starter for Lovable**\n", "").replace(/^> /gm, "")}

Also build, in this order, matching superfit-app/ (screens and copy):
1. Front-desk check-in: full-screen result. Green = active (first name, days left, tick sound); green + "Remind to renew" + chime when 3 days or fewer; red = denied with 2–4 words why (buzz). Quick buttons: Day pass, 1–2 week pass (with paper-card code), Link card. Use core/lib/membership/access.ts for every decision.
2. Till: products + plans on one ticket, member attached by card scan, pay by card machine / PromptPay QR (core/lib/payments/promptpay.ts) / cash. Price with core/lib/pos/ticket.ts. Drinks go to the cafe_orders board; every sale writes a sales row.
3. Site & content editor for menu, add-ons, ingredients, coaches, plans, business. Store each section as JSON in app_settings under catalog:<section>; validate with core/lib/catalog/validate.ts before saving.
4. Public site: home, cafe (product cards list ingredients and add-ons; live price and macros from core/lib/nutrition.ts), coaches, train (savings from core/lib/pricing.ts).
5. Admin sign-in: Supabase Auth, one Superfit owner account, staff pick "who's working" with a PIN.

Definitions: docs in superfit-app/docs/ (ADMIN-PLAN.md sections 3–4, MEMBERSHIP.md). Brand tokens: superfit-app/app/globals.css.
`,
);
writeFileSync(
  path.join(stage, "README.md"),
  `# Superfit master pack (${sha})

Built ${new Date().toISOString().slice(0, 10)} from commit ${sha}. Self-contained: it doesn't reference or change any other repo or Lovable project.

## Start a new Lovable project with it
1. **Database:** new Supabase project (Singapore). SQL editor → paste \`supabase/schema.sql\` → Run.
2. **Lovable:** new project, connect that Supabase. Paste \`LOVABLE_PROMPT.md\` as the first message.
3. **Rules:** upload the contents of \`core/\` into the project's \`src/\` (keep the folders: \`src/lib/...\`, \`src/content/...\`). The \`@/\` import alias must point at \`src/\` (Lovable's default).
4. **Reference:** \`superfit-app/\` is the complete working app (Next.js). Use it for screens, copy and behaviour, or run it as-is: \`cd superfit-app && npm install && npm run dev\`.

## What's in core/ (${coreFiles.length} files, no Next.js or database code)
${coreFiles.map((f) => `- ${f}`).join("\n")}
`,
);

// 5. Zip.
const zip = path.join(out, "superfit-master-pack.zip");
sh(`zip -qr "${zip}" superfit-master-pack`, out);
const kb = Math.round(readFileSync(zip).length / 1024);
console.log(`Pack ready: ${path.relative(root, zip)} (${kb} KB, commit ${sha}, ${coreFiles.length} core files)`);
