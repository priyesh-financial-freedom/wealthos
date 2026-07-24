"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { PlanningAssumptionHelpContent } from "@/services/planning/assumptions/AssumptionTypes";

interface AssumptionHelpPopoverProps {
  label: string;
  helpContent: PlanningAssumptionHelpContent;
  className?: string;
}

function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => {
      setIsTouchDevice(mediaQuery.matches);
    };

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  return isTouchDevice;
}

export function AssumptionHelpPopover({ label, helpContent, className }: AssumptionHelpPopoverProps) {
  const isTouchDevice = useIsTouchDevice();
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isOpen = isTouchDevice ? touchOpen : desktopOpen;

  useEffect(() => {
    if (!isTouchDevice || !touchOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target as Node)) {
        setTouchOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTouchOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isTouchDevice, touchOpen]);

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={isTouchDevice ? undefined : () => setDesktopOpen(true)}
      onMouseLeave={isTouchDevice ? undefined : () => setDesktopOpen(false)}
    >
      <button
        type="button"
        className="rounded-full text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onClick={() => {
          if (isTouchDevice) {
            setTouchOpen((current) => !current);
            return;
          }

          setDesktopOpen(true);
        }}
        onFocus={isTouchDevice ? undefined : () => setDesktopOpen(true)}
        onBlur={isTouchDevice ? undefined : () => setDesktopOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (isTouchDevice) {
              setTouchOpen(false);
              return;
            }

            setDesktopOpen(false);
          }
        }}
        aria-label={`Assumption help for ${label}`}
        aria-controls={contentId}
        aria-expanded={isOpen}
      >
        <CircleHelp className="h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          id={contentId}
          role={isTouchDevice ? "dialog" : "tooltip"}
          aria-label={`${label} details`}
          className="absolute right-0 top-7 z-50 w-80 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg shadow-slate-300/60"
        >
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <dl className="mt-2 space-y-2 text-xs text-slate-700">
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Short description</dt>
              <dd className="mt-0.5 leading-5">{helpContent.shortDescription}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Detailed explanation</dt>
              <dd className="mt-0.5 leading-5">{helpContent.detailedExplanation}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Why it matters</dt>
              <dd className="mt-0.5 leading-5">{helpContent.whyItMatters}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Recommended range</dt>
              <dd className="mt-0.5 leading-5">{helpContent.recommendedRange}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Default value</dt>
              <dd className="mt-0.5 leading-5">{helpContent.defaultValue}</dd>
            </div>
            {helpContent.exampleCalculation ? (
              <div>
                <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Example calculation</dt>
                <dd className="mt-0.5 leading-5">{helpContent.exampleCalculation}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Effect of increase</dt>
              <dd className="mt-0.5 leading-5">{helpContent.effectOfIncrease}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Effect of decrease</dt>
              <dd className="mt-0.5 leading-5">{helpContent.effectOfDecrease}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
