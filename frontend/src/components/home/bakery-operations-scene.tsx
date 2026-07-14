"use client";

import { ArrowRight, DoorOpen, LoaderCircle, LogIn, UserPlus } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DoorDestination, ScenePhase } from "@/components/home/bakery-door-scene";
import { ROUTES } from "@/constants/routes";

const BakeryDoorScene = dynamic(
  () => import("@/components/home/bakery-door-scene").then((module) => module.BakeryDoorScene),
  {
    loading: () => null,
    ssr: false,
  },
);

type WebGlStatus = "checking" | "supported" | "unsupported";

const messages: Record<Exclude<ScenePhase, "idle">, Record<DoorDestination, string>> = {
  celebrating: {
    login: "Welcome back! Happy to see you today.",
    signup: "Let's cook up something amazing!",
  },
  complete: {
    login: "Opening your secure workspace...",
    signup: "Opening your bakery workspace...",
  },
  greeting: {
    login: "Welcome back! Happy to see you today.",
    signup: "Let's cook up something amazing!",
  },
  opening: {
    login: "Welcome back! Happy to see you today.",
    signup: "Let's cook up something amazing!",
  },
  walking: {
    login: "The chef is heading to the Login Door...",
    signup: "The chef is heading to the Sign Up Door...",
  },
};

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function BakeryOperationsScene(): JSX.Element {
  const router = useRouter();
  const [destination, setDestination] = useState<DoorDestination | null>(null);
  const [phase, setPhase] = useState<ScenePhase>("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webGlStatus, setWebGlStatus] = useState<WebGlStatus>("checking");
  const animationCompleteRef = useRef<DoorDestination | null>(null);
  const minimumDurationElapsedRef = useRef(false);
  const minimumDurationTimeoutRef = useRef<number | null>(null);
  const isBusy = destination !== null && phase !== "idle";

  useEffect(() => {
    setWebGlStatus(supportsWebGl() ? "supported" : "unsupported");
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = (): void => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  const resetScene = useCallback((): void => {
    if (minimumDurationTimeoutRef.current !== null) {
      window.clearTimeout(minimumDurationTimeoutRef.current);
      minimumDurationTimeoutRef.current = null;
    }
    animationCompleteRef.current = null;
    minimumDurationElapsedRef.current = false;
    setDestination(null);
    setPhase("idle");
  }, []);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) resetScene();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      if (minimumDurationTimeoutRef.current !== null) {
        window.clearTimeout(minimumDurationTimeoutRef.current);
      }
    };
  }, [resetScene]);

  const selectDoor = useCallback(
    (nextDestination: DoorDestination): void => {
      if (isBusy) return;
      if (webGlStatus !== "supported") {
        router.push(nextDestination === "login" ? ROUTES.login : ROUTES.signup);
        return;
      }
      const minimumSequenceDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 700
        : 5000;
      animationCompleteRef.current = null;
      minimumDurationElapsedRef.current = false;
      minimumDurationTimeoutRef.current = window.setTimeout(() => {
        minimumDurationElapsedRef.current = true;
        const completedDestination = animationCompleteRef.current;
        if (completedDestination) {
          router.push(completedDestination === "login" ? ROUTES.login : ROUTES.signup);
        }
      }, minimumSequenceDuration);
      setDestination(nextDestination);
      setPhase("walking");
    },
    [isBusy, router, webGlStatus],
  );

  const completeInteraction = useCallback(
    (completedDestination: DoorDestination): void => {
      animationCompleteRef.current = completedDestination;
      if (minimumDurationElapsedRef.current) {
        router.push(completedDestination === "login" ? ROUTES.login : ROUTES.signup);
      }
    },
    [router],
  );

  const handlePhaseChange = useCallback(
    (nextPhase: ScenePhase, activeDestination: DoorDestination | null): void => {
      if (activeDestination === destination || activeDestination === null) setPhase(nextPhase);
    },
    [destination],
  );

  const statusMessage = destination && phase !== "idle" ? messages[phase][destination] : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {webGlStatus === "supported" ? (
        <BakeryDoorScene
          destination={destination}
          disabled={isBusy}
          onComplete={completeInteraction}
          onPhaseChange={handlePhaseChange}
          onSelect={selectDoor}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {webGlStatus === "checking" ? (
        <div className="absolute inset-0 flex items-center justify-end px-8 lg:px-16">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#3e4340]">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Preparing the kitchen...
          </div>
        </div>
      ) : null}

      {webGlStatus === "unsupported" ? (
        <div className="absolute bottom-6 right-5 z-10 max-w-sm border-l-2 border-[#45b894] bg-white/92 p-4 shadow-lg backdrop-blur-md sm:bottom-10 sm:right-10">
          <div className="flex items-start gap-3">
            <DoorOpen className="mt-0.5 h-5 w-5 text-[#3c8d76]" />
            <div>
              <p className="font-semibold text-[#171918]">Choose your entrance</p>
              <p className="mt-1 text-xs leading-5 text-[#646a67]">
                The interactive kitchen is unavailable, but account access remains ready.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-4 right-4 z-20 w-[min(22rem,calc(100%-2rem))] sm:bottom-8 sm:right-8">
        <div
          aria-live="polite"
          className="mb-2 min-h-10 border-l-2 border-[#45b894] bg-white/90 px-3 py-2 text-xs font-semibold text-[#171918] shadow-sm backdrop-blur-md"
          data-phase={phase}
          data-reduced-motion={reducedMotion ? "true" : "false"}
          data-testid="scene-status"
        >
          {statusMessage ?? "Choose a door. The chef will guide you inside."}
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Account entrance doors">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-black/15 bg-white/92 px-3 text-sm font-semibold text-[#26343d] shadow-sm transition hover:-translate-y-0.5 hover:border-[#426777] hover:bg-white disabled:cursor-wait disabled:opacity-60"
            data-testid="login-door-button"
            disabled={isBusy || webGlStatus === "checking"}
            onClick={() => selectDoor("login")}
            type="button"
          >
            <LogIn className="h-4 w-4" />
            Login
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#171918] px-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#343836] disabled:cursor-wait disabled:opacity-60"
            data-testid="signup-door-button"
            disabled={isBusy || webGlStatus === "checking"}
            onClick={() => selectDoor("signup")}
            type="button"
          >
            <UserPlus className="h-4 w-4" />
            Sign Up
            <ArrowRight className="hidden h-4 w-4 sm:block" />
          </button>
        </div>
      </div>
    </div>
  );
}
