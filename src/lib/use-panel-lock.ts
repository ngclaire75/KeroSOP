"use client";

import { useEffect, useRef, type RefObject } from "react";

const panels: HTMLElement[] = [];
const inertBefore = new Map<HTMLElement, boolean>();
let overflowBefore: [string, string] | null = null;

export const hasOpenPanel = () => panels.length > 0;

function refreshLock() {
  for (const [element, inert] of inertBefore) element.inert = inert;
  inertBefore.clear();
  const top = panels.at(-1);
  if (!top) return;
  // Inert every sibling on the path to the body, without disabling the panel
  // itself. This also works for panels rendered inside another open panel.
  let branch: HTMLElement = top;
  while (branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling !== branch && sibling instanceof HTMLElement) {
        inertBefore.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
    branch = branch.parentElement;
    if (branch === document.body) break;
  }
}

export function usePanelLock(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!panels.length) {
      overflowBefore = [document.body.style.overflow, document.documentElement.style.overflow];
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    panels.push(panel);
    refreshLock();
    const previousTabIndex = panel.getAttribute("tabindex");
    panel.tabIndex = -1;
    const controls = () => [...panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.tabIndex >= 0 && !element.closest('[inert]') && element.getClientRects().length);
    const focusInside = () => (controls()[0] ?? panel).focus({ preventScroll: true });
    focusInside();
    const keydown = (event: KeyboardEvent) => {
      if (panels.at(-1) !== panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0] ?? panel;
        const last = items.at(-1) ?? panel;
        if (!items.length || !panel.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (panels.at(-1) === panel && !panel.contains(event.target as Node)) focusInside();
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      panels.splice(panels.indexOf(panel), 1);
      if (previousTabIndex === null) panel.removeAttribute("tabindex");
      else panel.setAttribute("tabindex", previousTabIndex);
      refreshLock();
      if (!panels.length && overflowBefore) {
        [document.body.style.overflow, document.documentElement.style.overflow] = overflowBefore;
        overflowBefore = null;
      }
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
