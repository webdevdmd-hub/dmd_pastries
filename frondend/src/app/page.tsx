import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Building2,
  CheckCircle2,
  CircuitBoard,
  Croissant,
  DatabaseZap,
  Fingerprint,
  Gauge,
  Layers3,
  LockKeyhole,
  Network,
  PackageCheck,
  Rocket,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { FoundationHeroEffects, ParallaxLayer } from "@/components/home/foundation-hero-effects";
import { StorySectionReveal } from "@/components/home/story-section-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const ecosystemModules = [
  {
    name: "POS Billing",
    tone: "from-brand-caramel/35 to-brand-latte/10",
  },
  {
    name: "Products",
    tone: "from-brand-latte/18 to-transparent",
  },
  {
    name: "Payments",
    tone: "from-amber-200/18 to-transparent",
  },
  {
    name: "Customers",
    tone: "from-brand-cappuccino/22 to-transparent",
  },
  {
    name: "Inventory",
    tone: "from-brand-caramel/28 to-transparent",
  },
  {
    name: "Purchasing",
    tone: "from-brand-latte/14 to-transparent",
  },
  {
    name: "Suppliers",
    tone: "from-brand-cappuccino/20 to-transparent",
  },
  {
    name: "Recipes",
    tone: "from-brand-caramel/24 to-transparent",
  },
  {
    name: "Packaging",
    tone: "from-brand-latte/16 to-transparent",
  },
  {
    name: "Manufacturing",
    tone: "from-amber-100/14 to-transparent",
  },
  {
    name: "Bakery Orders",
    tone: "from-brand-caramel/32 to-transparent",
  },
  {
    name: "Branch Control",
    tone: "from-brand-cappuccino/18 to-transparent",
  },
];

const foundationPillars = [
  {
    icon: Croissant,
    eyebrow: "Identity",
    title: "Bakery-first, not generic SaaS.",
    description:
      "The visual system moves from simple operational screens into a warmer, richer bakery operating identity built with latte, mocha, caramel, and bronze depth.",
  },
  {
    icon: Fingerprint,
    eyebrow: "Access",
    title: "Secure auth and branch-aware control.",
    description:
      "Appwrite sessions sync with backend users, role permissions, branch context, and operational access so every action can be scoped correctly.",
  },
  {
    icon: CircuitBoard,
    eyebrow: "Engineering",
    title: "Typed foundations for serious scale.",
    description:
      "Strict TypeScript, centralized API clients, Zod validation, TanStack Query, and backend-owned validation keep the frontend reliable as modules expand.",
  },
];

const buildSequence = [
  {
    label: "01",
    title: "Foundation",
    detail:
      "Auth, shell, design tokens, typed APIs, permission-aware navigation, and README memory.",
  },
  {
    label: "02",
    title: "Connected Operations",
    detail:
      "POS, products, customers, payments, inventory, purchasing, recipes, packaging, and manufacturing become one workflow system.",
  },
  {
    label: "03",
    title: "Commercial Readiness",
    detail:
      "Branch isolation, stock movement audit, production batches, bakery orders, and reporting polish move the product toward real rollout.",
  },
];

const foundationIncludes = [
  "Strict TypeScript and safe type boundaries",
  "Centralized typed API client",
  "Permission-aware pages, buttons, and navigation",
  "Branch-scoped operational context",
  "Appwrite auth plus backend profile sync",
  "POS, inventory, purchasing, and production foundations",
  "README-backed implementation memory",
  "Responsive dashboard and register layouts",
];

const trustModel = [
  "Validation",
  "Permissions",
  "Branch isolation",
  "Stock quantities",
  "Financial totals",
  "Operational status transitions",
];

const roadmap = [
  {
    icon: PackageCheck,
    title: "Operational polish",
    description:
      "Tighten high-volume POS, payments, purchasing, production, and bakery order flows for daily users.",
  },
  {
    icon: Boxes,
    title: "Inventory intelligence",
    description:
      "Convert stock, expiry, recipe, wastage, and production movement signals into clearer decisions.",
  },
  {
    icon: Rocket,
    title: "Commercial readiness",
    description:
      "Prepare reporting, onboarding, subscriptions, and deployment polish for a real SaaS launch.",
  },
];

export default function HomePage(): JSX.Element {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060403] text-brand-latte">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(176,137,104,0.38),transparent_28%),radial-gradient(circle_at_84%_10%,rgba(243,233,215,0.14),transparent_26%),radial-gradient(circle_at_58%_55%,rgba(122,85,58,0.42),transparent_34%),linear-gradient(180deg,#060403_0%,#150f0b_38%,#2a1c13_72%,#080504_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:linear-gradient(rgba(243,233,215,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(243,233,215,0.035)_1px,transparent_1px)] [background-size:84px_84px] [mask-image:radial-gradient(circle_at_center,black,transparent_74%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(243,233,215,0.18),transparent_36%)]" />

      <FoundationHeroEffects>
        <section className="relative mx-auto flex min-h-screen max-w-[92rem] flex-col px-5 py-6 sm:px-8 lg:px-10">
          <ParallaxLayer
            className="pointer-events-none absolute left-[-10rem] top-28 h-[34rem] w-[34rem] rounded-full bg-brand-caramel/24 blur-3xl transition-transform duration-300 ease-out"
            depth={-32}
          >
            <span />
          </ParallaxLayer>
          <ParallaxLayer
            className="pointer-events-none absolute right-[-12rem] top-12 h-[38rem] w-[38rem] rounded-full bg-brand-latte/10 blur-3xl transition-transform duration-300 ease-out"
            depth={36}
          >
            <span />
          </ParallaxLayer>

          <nav className="relative z-20 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.07] px-4 py-3 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
            <Link className="group flex items-center gap-3" href={ROUTES.home}>
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-latte/15 bg-brand-caramel/18 shadow-[0_0_48px_rgba(176,137,104,0.32)] transition group-hover:scale-105 group-hover:bg-brand-caramel/30">
                <Croissant className="h-5 w-5 text-brand-latte" />
              </div>
              <div>
                <p className="font-display text-xl leading-none tracking-tight text-brand-latte">
                  Pastries POS
                </p>
                <p className="hidden text-[0.65rem] uppercase tracking-[0.24em] text-brand-cappuccino/80 sm:block">
                  Bakery operations platform
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Button
                asChild
                className="hidden rounded-full border-white/10 bg-white/[0.06] px-5 text-brand-latte shadow-none hover:bg-white/[0.12] sm:inline-flex"
                variant="outline"
              >
                <Link href={ROUTES.login}>Login</Link>
              </Button>
              <Button
                asChild
                className="rounded-full bg-brand-latte px-5 text-brand-espresso shadow-[0_18px_52px_rgba(243,233,215,0.18)] hover:bg-brand-cappuccino"
              >
                <Link href={ROUTES.signup}>
                  Start onboarding
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </nav>

          <div className="relative z-10 grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
            <div className="space-y-9">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-brand-caramel/40 bg-brand-caramel/15 px-4 py-2 text-brand-latte shadow-[0_0_42px_rgba(176,137,104,0.2)]">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Premium bakery OS foundation
                </Badge>
                <Badge className="border-white/10 bg-white/[0.06] px-4 py-2 text-brand-cappuccino">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Backend-trusted operations
                </Badge>
              </div>

              <div className="space-y-7">
                <h1 className="max-w-5xl font-sans text-5xl font-semibold leading-[0.96] tracking-[-0.075em] text-brand-latte sm:text-7xl lg:text-[6.6rem]">
                  The complete bakery operating system, engineered for serious growth.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-brand-latte/72">
                  A premium SaaS foundation for bakeries, retailers, restaurants, grocery teams, and
                  production workflows. Every screen is backed by typed APIs, secure access, branch
                  isolation, and operational logic owned by the backend.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  className="h-13 rounded-full bg-brand-caramel px-7 text-brand-latte shadow-[0_22px_65px_rgba(176,137,104,0.32)] transition hover:-translate-y-0.5 hover:bg-brand-mocha hover:shadow-[0_28px_80px_rgba(176,137,104,0.4)]"
                >
                  <Link href={ROUTES.signup}>
                    Start owner onboarding
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  className="h-13 rounded-full border-white/12 bg-white/[0.07] px-7 text-brand-latte shadow-none backdrop-blur-xl hover:-translate-y-0.5 hover:bg-white/[0.13]"
                  variant="outline"
                >
                  <Link href="#ecosystem">
                    Explore the foundation
                    <ArrowDown className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ["12+", "Connected modules"],
                  ["RBAC", "Granular permissions"],
                  ["Branch", "Scoped operations"],
                ].map(([value, label]) => (
                  <div
                    className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl"
                    key={label}
                  >
                    <p className="font-display text-3xl text-brand-latte">{value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-cappuccino/75">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative" id="ecosystem">
              <ParallaxLayer
                className="absolute inset-8 rounded-full bg-brand-caramel/28 blur-3xl transition-transform duration-300 ease-out"
                depth={24}
              >
                <span />
              </ParallaxLayer>
              <ParallaxLayer
                className="relative overflow-hidden rounded-[2.35rem] border border-white/12 bg-white/[0.08] p-3 shadow-[0_50px_140px_rgba(0,0,0,0.58)] backdrop-blur-2xl transition duration-500 hover:-translate-y-1 hover:border-brand-caramel/35"
                depth={-18}
              >
                <div className="relative overflow-hidden rounded-[1.85rem] border border-white/10 bg-[#0f0a07]/90 p-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_30%,rgba(176,137,104,0.28),transparent_30%),linear-gradient(135deg,rgba(243,233,215,0.08),transparent_38%)]" />
                  <div className="relative">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-brand-cappuccino/80">
                          Platform architecture
                        </p>
                        <h2 className="mt-2 font-display text-4xl leading-none text-brand-latte">
                          Pastries OS Core
                        </h2>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-caramel/30 bg-brand-caramel/20 text-brand-latte shadow-[0_0_45px_rgba(176,137,104,0.28)]">
                        <Network className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {ecosystemModules.map((module, index) => (
                        <div
                          className={`group rounded-3xl border border-white/10 bg-gradient-to-br ${module.tone} p-4 text-sm text-brand-latte/84 transition hover:-translate-y-0.5 hover:border-brand-caramel/45 hover:bg-white/[0.08]`}
                          key={module.name}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <span className="font-display text-2xl text-brand-caramel">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="h-2 w-2 rounded-full bg-brand-caramel shadow-[0_0_18px_rgba(176,137,104,0.9)]" />
                          </div>
                          <p className="font-medium">{module.name}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.8fr]">
                      <div className="rounded-3xl border border-brand-caramel/25 bg-brand-caramel/12 p-5">
                        <div className="flex items-start gap-3">
                          <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-brand-caramel" />
                          <div>
                            <p className="font-semibold text-brand-latte">
                              Backend is the source of truth
                            </p>
                            <p className="mt-2 text-sm leading-6 text-brand-latte/64">
                              The interface guides action. The backend owns correctness: validation,
                              permissions, branch isolation, stock, totals, and status rules.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                        <Gauge className="mb-4 h-5 w-5 text-brand-caramel" />
                        <p className="text-xs uppercase tracking-[0.24em] text-brand-cappuccino/80">
                          Readiness
                        </p>
                        <p className="mt-2 font-display text-4xl text-brand-latte">Phase 4+</p>
                        <p className="mt-2 text-sm leading-6 text-brand-latte/60">
                          Built beyond a demo into connected operations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ParallaxLayer>
            </div>
          </div>
        </section>
      </FoundationHeroEffects>

      <StorySectionReveal>
        <section className="relative border-y border-white/10 bg-[#100a07] px-5 py-24 text-brand-latte sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(176,137,104,0.18),transparent_28%),radial-gradient(circle_at_80%_60%,rgba(243,233,215,0.08),transparent_32%)]" />
          <div className="relative mx-auto max-w-[92rem]">
            <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
              <div>
                <p className="mb-4 text-xs uppercase tracking-[0.3em] text-brand-cappuccino">
                  Product identity
                </p>
                <h2 className="font-sans text-5xl font-semibold leading-[1] tracking-[-0.055em] sm:text-6xl">
                  A richer operating narrative for bakery teams.
                </h2>
              </div>
              <p className="max-w-3xl text-lg leading-8 text-brand-latte/68">
                The foundation is designed to help beginner users understand a complex business
                system without making the product feel basic. It presents identity, security, typed
                engineering, and operations as one coherent platform.
              </p>
            </div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {foundationPillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <article
                    className="group relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.07] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-brand-caramel/35 hover:bg-white/[0.1]"
                    key={pillar.title}
                  >
                    <div className="absolute right-[-3rem] top-[-3rem] h-32 w-32 rounded-full bg-brand-caramel/16 blur-2xl transition group-hover:bg-brand-caramel/28" />
                    <div className="relative">
                      <div className="mb-8 flex items-center justify-between">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-caramel/25 bg-brand-caramel/14 text-brand-cappuccino transition group-hover:bg-brand-caramel group-hover:text-brand-latte">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs uppercase tracking-[0.18em] text-brand-cappuccino">
                          {pillar.eyebrow}
                        </span>
                      </div>
                      <h3 className="text-3xl font-semibold leading-tight text-brand-latte">
                        {pillar.title}
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-brand-latte/64">
                        {pillar.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </StorySectionReveal>

      <StorySectionReveal variant="slide-left">
        <section className="relative bg-[#090604] px-5 py-24 text-brand-latte sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(243,233,215,0.04)_1px,transparent_1px)] bg-[size:110px_110px] opacity-70" />
          <div className="relative mx-auto grid max-w-[92rem] gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="lg:sticky lg:top-10 lg:h-fit">
              <Badge className="mb-5 border-white/10 bg-white/[0.08] text-brand-latte">
                <Layers3 className="mr-2 h-4 w-4" />
                Build sequence
              </Badge>
              <h2 className="font-sans text-5xl font-semibold leading-[1] tracking-[-0.055em]">
                The product story unfolds in operational layers.
              </h2>
              <p className="mt-5 text-sm leading-7 text-brand-latte/64">
                Each phase explains why the system exists, what it connects, and how it becomes
                safer for real teams as the operational surface grows.
              </p>
            </div>

            <div className="space-y-5">
              {buildSequence.map((step) => (
                <article
                  className="group rounded-[2.2rem] border border-white/10 bg-white/[0.075] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl transition hover:border-brand-caramel/35 hover:bg-white/[0.1]"
                  key={step.label}
                >
                  <div className="grid gap-6 sm:grid-cols-[5rem_1fr] sm:items-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-brand-caramel/30 bg-brand-caramel/12 font-display text-3xl text-brand-caramel shadow-[0_0_42px_rgba(176,137,104,0.16)]">
                      {step.label}
                    </div>
                    <div>
                      <h3 className="text-3xl font-semibold text-brand-latte">{step.title}</h3>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-latte/66">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </StorySectionReveal>

      <StorySectionReveal variant="slide-right">
        <section className="relative bg-[#130d09] px-5 py-24 text-brand-latte sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(176,137,104,0.22),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-[92rem] gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[2.3rem] border border-white/10 bg-white/[0.075] p-8 shadow-[0_35px_100px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="mb-8 flex items-center gap-3">
                <DatabaseZap className="h-6 w-6 text-brand-caramel" />
                <p className="text-xs uppercase tracking-[0.3em] text-brand-cappuccino">
                  Current foundation includes
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {foundationIncludes.map((item) => (
                  <div
                    className="flex items-start gap-3 rounded-3xl border border-white/8 bg-white/[0.055] p-4"
                    key={item}
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-caramel" />
                    <span className="text-sm leading-6 text-brand-latte/72">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2.3rem] border border-brand-caramel/25 bg-[#080504] p-8 shadow-[0_35px_100px_rgba(0,0,0,0.38)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(176,137,104,0.28),transparent_34%)]" />
              <div className="relative">
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-caramel/25 bg-brand-caramel/16">
                  <Building2 className="h-7 w-7 text-brand-caramel" />
                </div>
                <h2 className="font-sans text-5xl font-semibold leading-[1] tracking-[-0.055em]">
                  Ready for operational reality.
                </h2>
                <p className="mt-5 text-sm leading-7 text-brand-latte/68">
                  The foundation now speaks the language of the business: sell, receive, stock,
                  make, package, schedule, reconcile, and report without losing correctness.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  {trustModel.map((item) => (
                    <div
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-brand-latte/72"
                      key={item}
                    >
                      <BadgeCheck className="mb-2 h-4 w-4 text-brand-caramel" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </StorySectionReveal>

      <StorySectionReveal variant="scale">
        <section className="relative bg-[#060403] px-5 py-24 text-brand-latte sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(243,233,215,0.12),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(176,137,104,0.2),transparent_34%)]" />
          <div className="relative mx-auto max-w-[92rem]">
            <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <p className="mb-4 text-xs uppercase tracking-[0.3em] text-brand-cappuccino">
                  Next movement
                </p>
                <h2 className="max-w-4xl font-sans text-5xl font-semibold leading-[1] tracking-[-0.055em] sm:text-6xl">
                  The roadmap moves from foundation to commercial confidence.
                </h2>
              </div>
              <Button
                asChild
                className="w-fit rounded-full bg-brand-latte px-7 text-brand-espresso shadow-[0_22px_70px_rgba(243,233,215,0.18)] hover:bg-brand-cappuccino"
              >
                <Link href={ROUTES.login}>
                  Enter workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {roadmap.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    className="group rounded-[2.2rem] border border-white/10 bg-white/[0.075] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.26)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-brand-caramel/35 hover:bg-white/[0.1]"
                    key={item.title}
                  >
                    <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-caramel/25 bg-brand-caramel/14 transition group-hover:bg-brand-caramel group-hover:text-brand-latte">
                      <Icon className="h-7 w-7 text-brand-caramel transition group-hover:text-brand-latte" />
                    </div>
                    <h3 className="text-2xl font-semibold text-brand-latte">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-brand-latte/64">{item.description}</p>
                  </article>
                );
              })}
            </div>

            <div className="mt-16 overflow-hidden rounded-[2.5rem] border border-brand-caramel/25 bg-brand-caramel/12 p-8 shadow-[0_35px_110px_rgba(0,0,0,0.34)] backdrop-blur-xl">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="mb-4 flex items-center gap-3 text-brand-cappuccino">
                    <Store className="h-5 w-5" />
                    <p className="text-xs uppercase tracking-[0.3em]">Commercial product signal</p>
                  </div>
                  <h3 className="max-w-3xl font-sans text-4xl font-semibold leading-tight tracking-[-0.045em] text-brand-latte">
                    Built for bakery teams that need clarity, control, and confidence at scale.
                  </h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="rounded-full bg-brand-latte px-7 text-brand-espresso hover:bg-brand-cappuccino"
                  >
                    <Link href={ROUTES.signup}>Create account</Link>
                  </Button>
                  <Button
                    asChild
                    className="rounded-full border-white/12 bg-white/[0.08] px-7 text-brand-latte hover:bg-white/[0.14]"
                    variant="outline"
                  >
                    <Link href={ROUTES.login}>Login</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </StorySectionReveal>
    </main>
  );
}
