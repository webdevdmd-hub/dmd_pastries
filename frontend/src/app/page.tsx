import {
  ArrowRight,
  BarChart3,
  Boxes,
  Factory,
  Landmark,
  PackageSearch,
  ReceiptText,
  ShoppingBasket,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { BakeryOperationsScene } from "@/components/home/bakery-operations-scene";
import { ROUTES } from "@/constants/routes";

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
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6f5] text-[#171918]">
      <section className="relative min-h-[96svh] overflow-hidden border-b border-black/10 lg:min-h-[88svh]">
        <BakeryOperationsScene />

        <header className="relative z-20 mx-auto flex h-20 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link className="flex items-center gap-3" href={ROUTES.home}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171918] text-white">
              <Store className="h-4 w-4" />
            </span>
            <span>
              <span className="block whitespace-nowrap text-sm font-bold leading-none">
                Pastries POS
              </span>
              <span className="mt-1 hidden text-[0.64rem] uppercase text-[#646a67] sm:block">
                Bakery operations
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2" aria-label="Account access">
            <Link
              aria-label="Login"
              className="hidden h-10 items-center justify-center px-3 text-sm font-semibold text-[#3e4340] transition-colors hover:text-black sm:inline-flex"
              href={ROUTES.login}
              title="Login"
            >
              <span>Login</span>
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-[#171918] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#343836] sm:px-4 sm:text-sm"
              href={ROUTES.signup}
            >
              <span className="sm:hidden">Sign up</span>
              <span className="hidden sm:inline">Create account</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        <div className="pointer-events-none relative z-10 mx-auto grid min-h-[calc(96svh-5rem)] max-w-[90rem] items-start px-5 pb-24 pt-8 sm:items-center sm:px-8 sm:pt-10 lg:min-h-[calc(88svh-5rem)] lg:grid-cols-[0.82fr_1.18fr] lg:px-12 lg:pb-16 lg:pt-0">
          <div className="pointer-events-auto max-w-2xl">
            <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase text-[#646a67]">
              <span className="h-2 w-2 rounded-full bg-[#45b894]" />
              Production-based bakery ERP
            </p>
            <h1 className="text-4xl font-semibold leading-[1.04] sm:text-6xl sm:leading-[0.98] lg:text-7xl">
              Run your bakery from one system.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[#555b58] sm:mt-6 sm:text-lg sm:leading-8">
              Pastries POS connects counter sales, purchasing, inventory, recipes, production,
              bakery orders, accounting, and reports across every branch.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex h-12 items-center gap-2 rounded-md bg-[#171918] px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                href={ROUTES.signup}
              >
                Start owner onboarding
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex h-12 items-center px-4 text-sm font-semibold text-[#3e4340] hover:text-black"
                href="#how-it-works"
              >
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 bg-white" id="how-it-works">
        <div className="mx-auto max-w-[90rem] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-bold uppercase text-[#45a987]">One connected workflow</p>
              <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
                From first sale to final report.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#646a67]">
                Every operational step shares the same branch, product, stock, customer, and
                financial context.
              </p>
            </div>

            <ol className="grid border-y border-black/10 sm:grid-cols-2 lg:grid-cols-4 lg:border-y-0 lg:border-l">
              {operatingFlow.map(([number, title, detail]) => (
                <li
                  className="border-b border-black/10 py-5 sm:px-5 lg:border-b-0 lg:border-r"
                  key={number}
                >
                  <span className="text-xs font-bold text-[#f2735b]">{number}</span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-5 text-[#646a67]">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-[#171918] text-white">
        <div className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mb-12 flex flex-col justify-between gap-5 border-b border-white/15 pb-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase text-[#67d0ad]">What the app manages</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
                Daily operations, without disconnected tools.
              </h2>
            </div>
            <div className="flex items-center gap-5 text-sm text-white/60">
              <span className="flex items-center gap-2">
                <Boxes className="h-4 w-4" /> Branch aware
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Role controlled
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2">
            {moduleGroups.map((group, index) => {
              const Icon = group.icon;
              return (
                <article
                  className={`border-white/15 py-8 lg:min-h-64 lg:p-9 ${
                    index < 2 ? "border-b" : ""
                  } ${index % 2 === 0 ? "lg:border-r" : ""}`}
                  key={group.label}
                >
                  <div className="flex items-start gap-4">
                    <Icon className="mt-1 h-5 w-5 shrink-0 text-[#67d0ad]" />
                    <div>
                      <h3 className="text-xl font-semibold">{group.label}</h3>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-white/64">
                        {group.detail}
                      </p>
                      <p className="mt-7 text-xs font-bold uppercase text-[#f58a75]">
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

      <section className="bg-[#dcefe8]">
        <div className="mx-auto flex max-w-[90rem] flex-col justify-between gap-8 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:px-12 lg:py-16">
          <div>
            <div className="flex items-center gap-4 text-[#3e4340]">
              <ReceiptText className="h-5 w-5" />
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight">
              One place to sell, make, track, and understand your bakery.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center rounded-md border border-black/20 px-5 text-sm font-semibold hover:bg-white/50"
              href={ROUTES.login}
            >
              Login
            </Link>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#171918] px-5 text-sm font-semibold text-white hover:bg-[#343836]"
              href={ROUTES.signup}
            >
              Create owner account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
