import { ArrowRight, Factory, Landmark, PackageSearch, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { ROUTES } from "@/constants/routes";

/**
 * Landing page, Threshold register (DESIGN.md §7, plan item D3).
 *
 * The structure is prescribed: Geist Mono eyebrow, Fraunces headline at
 * `text-display`, a Geist sub-paragraph, ONE `--primary` CTA, then the
 * photograph. It is Square's structure and Midday's structure, arrived at
 * independently by the POS category leader and the accounting-SaaS reference.
 *
 * WHAT CHANGED FROM THE PREVIOUS VERSION
 *
 * - 20 hardcoded hexes, and six off-system accents among them: a #45b894 mint dot,
 *   #45a987, #67d0ad, #f2735b coral, #f58a75, and a #dcefe8 mint band. The system
 *   has one accent and it means money.
 * - Five uppercase eyebrows. §7 allows exactly one per page, and §2 bans the
 *   pattern everywhere else because at ~10px with wide tracking it is both the most
 *   dating detail in the build and unreadable.
 * - Two competing hero CTAs ("Start owner onboarding" and "See how it works").
 *   §7 is explicit: one --primary CTA, not two competing ones. A second link at
 *   equal weight is the visitor's cue that neither is the thing to do.
 * - font-bold / font-semibold throughout. 500 is the workhorse, 600 for page
 *   titles, nothing above (§2).
 * - No Fraunces anywhere, despite this being the one register that calls for it.
 *
 * THE PHOTOGRAPH IS STILL MISSING, DELIBERATELY
 *
 * §7 item 5 is one real photograph of a real counter — product, hands, a person —
 * and the plan blocks D3 on it while saying "ship type-only until it exists; still
 * better than the door scene." So this ships type-only, and the hero is a single
 * generous column rather than a two-column grid with an empty half, which is what
 * it looked like after D4 removed the WebGL scene.
 *
 * When the photograph arrives it goes full-bleed below the hero, and the hero stays
 * exactly as it is. That is the whole reason to build it this way now.
 */

const operatingFlow = [
  ["01", "Sell", "POS billing and bakery orders"],
  ["02", "Source", "Purchasing and suppliers"],
  ["03", "Make", "Recipes and production"],
  ["04", "Control", "Stock, accounts, and reports"],
] as const;

const moduleGroups = [
  {
    icon: ShoppingBasket,
    label: "Sell & serve",
    detail:
      "Fast counter billing, customer records, channel orders, payments, and scheduled bakery orders.",
    modules: "POS / Customers / Bakery orders / Payments",
  },
  {
    icon: PackageSearch,
    label: "Stock & source",
    detail:
      "Receive purchases, track ingredients and packaging, manage suppliers, and understand stock movement.",
    modules: "Products / Inventory / Purchasing / Suppliers",
  },
  {
    icon: Factory,
    label: "Plan & produce",
    detail:
      "Turn recipes into controlled production batches with material requirements, yield, and wastage visibility.",
    modules: "Recipes / Manufacturing / Packaging / Wastage",
  },
  {
    icon: Landmark,
    label: "Govern & understand",
    detail:
      "Keep branches, roles, accounting entries, audit trails, and operational reporting connected.",
    modules: "Accounting / Reports / Users / Branches",
  },
] as const;

export default function HomePage(): JSX.Element {
  return (
    <main className="min-h-screen overflow-x-hidden bg-canvas text-foreground">
      <header className="mx-auto flex h-20 max-w-[78rem] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link className="flex items-baseline gap-2" href={ROUTES.home}>
          {/* Fraunces wordmark. Per DESIGN.md §1 the bakery identity now lives in
              exactly one serif wordmark on threshold surfaces and in nothing else —
              which is both more modern and more honest than a cream background on a
              screen that runs a trial balance. */}
          <span className="font-serif text-title leading-none">Pastries POS</span>
          <span className="text-meta text-foreground-muted">Bakery operations</span>
        </Link>

        {/* Both of these are deliberately quiet. A filled --primary button here
            would sit in the same viewport as the hero CTA — measured at y=20 and
            y=484 on a 900px screen — and §7 item 4 is explicit: one --primary CTA,
            not two competing ones. Someone arriving should have exactly one obvious
            next action, and it is the one next to the headline. */}
        <nav aria-label="Account access" className="flex items-center gap-1">
          <Link
            className="text-body inline-flex h-10 items-center rounded px-3 font-medium text-foreground-muted transition-colors hover:text-foreground"
            href={ROUTES.login}
          >
            Login
          </Link>
          <Link
            className="text-body inline-flex h-10 items-center gap-2 whitespace-nowrap rounded border border-border bg-card px-4 font-medium text-foreground transition-colors hover:bg-muted"
            href={ROUTES.signup}
          >
            Create account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-[78rem] px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:px-12">
        {/* The one permitted uppercase eyebrow on the site (DESIGN.md §7 item 1).
            Everywhere else this pattern is banned, so the rule is disabled here with
            a reason rather than weakened — which is the escape hatch the plan's §5
            specifies for exactly this case. */}
        {/* eslint-disable-next-line design/no-uppercase -- DESIGN.md §7 item 1: the single permitted threshold eyebrow, Geist Mono at 12.5px */}
        <p className="text-meta flex items-center gap-2 font-mono uppercase tracking-[0.1em] text-foreground-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-money" />
          Production-based bakery ERP
        </p>

        {/* Fraunces, text-display (68px/1, -0.03em, weight 400), sentence case,
            ~16ch so it breaks into a stack rather than running as one long line. */}
        <h1 className="text-display mt-6 max-w-[16ch] font-serif text-foreground">
          Run your bakery from one system.
        </h1>

        <p className="text-body mt-7 max-w-[54ch] text-foreground-muted sm:text-lg sm:leading-8">
          Pastries POS connects counter sales, purchasing, inventory, recipes, production, bakery
          orders, accounting, and reports across every branch.
        </p>

        {/* One CTA. The previous "See how it works" link sat beside this at equal
            weight, which told a visitor that neither was the thing to do. */}
        <Link
          className="text-body mt-10 inline-flex h-12 items-center gap-2 rounded bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          href={ROUTES.signup}
        >
          Start owner onboarding
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="border-t border-border bg-card" id="how-it-works">
        <div className="mx-auto max-w-[78rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <h2 className="text-page max-w-md text-foreground">
                From first sale to final report.
              </h2>
              <p className="text-body mt-4 max-w-md text-foreground-muted">
                Every operational step shares the same branch, product, stock, customer, and
                financial context.
              </p>
            </div>

            {/* Numbered because this genuinely is a sequence — sell, source, make,
                control — rather than as decoration. */}
            <ol className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-4 lg:border-l lg:border-t-0">
              {operatingFlow.map(([number, title, detail]) => (
                <li
                  className="border-b border-border py-6 sm:px-6 lg:border-b-0 lg:border-r"
                  key={number}
                >
                  <span className="text-meta font-mono tabular-nums text-foreground-muted">
                    {number}
                  </span>
                  <h3 className="text-title mt-4 text-foreground">{title}</h3>
                  <p className="text-cell mt-2 text-foreground-muted">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-[78rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <h2 className="text-page max-w-2xl border-b border-primary-foreground/15 pb-8">
            Daily operations, without disconnected tools.
          </h2>

          <div className="grid lg:grid-cols-2">
            {moduleGroups.map((group, index) => {
              const Icon = group.icon;
              return (
                <article
                  className={`border-primary-foreground/15 py-8 lg:min-h-60 lg:p-9 ${
                    index < 2 ? "border-b" : ""
                  } ${index % 2 === 0 ? "lg:border-r" : ""}`}
                  key={group.label}
                >
                  <div className="flex items-start gap-4">
                    {/* Muted on an inverted surface has to come from
                        --primary-foreground, not --foreground-muted: the latter is
                        tuned for light grounds and lands around 2.5:1 on #171717. */}
                    <Icon
                      aria-hidden
                      className="mt-1 h-5 w-5 shrink-0 text-primary-foreground/70"
                    />
                    <div>
                      <h3 className="text-title text-primary-foreground">{group.label}</h3>
                      <p className="text-body mt-3 max-w-xl text-primary-foreground/70">
                        {group.detail}
                      </p>
                      <p className="text-meta mt-6 font-mono text-primary-foreground/60">
                        {group.modules}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-[78rem] flex-col justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <h2 className="text-page max-w-2xl text-foreground">
            One place to sell, make, track, and understand your bakery.
          </h2>
          <Link
            className="text-body inline-flex h-12 shrink-0 items-center gap-2 self-start rounded bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:self-auto"
            href={ROUTES.signup}
          >
            Create owner account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
