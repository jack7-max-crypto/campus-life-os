"use client";

import { useEffect } from "react";

let lockCount = 0;
let scrollY = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> = {};
let previousHtmlStyles: Partial<CSSStyleDeclaration> = {};
let touchStartY = 0;
const scrollableSelector = "[data-scroll-lock-scrollable='true']";

function shouldLock(mediaQuery?: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return mediaQuery ? window.matchMedia(mediaQuery).matches : true;
}

function lockScroll() {
  const { body, documentElement } = document;

  if (lockCount === 0) {
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    scrollY = window.scrollY;
    previousHtmlStyles = {
      overflow: documentElement.style.overflow,
      overscrollBehavior: documentElement.style.overscrollBehavior,
      scrollBehavior: documentElement.style.scrollBehavior,
    };
    previousBodyStyles = {
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };

    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    documentElement.style.scrollBehavior = "auto";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.addEventListener("touchstart", recordTouchStart, { passive: true });
    document.addEventListener("touchmove", preventBackgroundTouchMove, { passive: false });
  }

  lockCount += 1;
}

function unlockScroll() {
  if (lockCount === 0) {
    return;
  }

  lockCount -= 1;

  if (lockCount > 0) {
    return;
  }

  const { body, documentElement } = document;
  documentElement.style.overflow = previousHtmlStyles.overflow ?? "";
  documentElement.style.overscrollBehavior = previousHtmlStyles.overscrollBehavior ?? "";
  documentElement.style.scrollBehavior = previousHtmlStyles.scrollBehavior ?? "";
  body.style.overflow = previousBodyStyles.overflow ?? "";
  body.style.overscrollBehavior = previousBodyStyles.overscrollBehavior ?? "";
  body.style.position = previousBodyStyles.position ?? "";
  body.style.top = previousBodyStyles.top ?? "";
  body.style.left = previousBodyStyles.left ?? "";
  body.style.right = previousBodyStyles.right ?? "";
  body.style.width = previousBodyStyles.width ?? "";
  body.style.paddingRight = previousBodyStyles.paddingRight ?? "";
  document.removeEventListener("touchstart", recordTouchStart);
  document.removeEventListener("touchmove", preventBackgroundTouchMove);
  window.scrollTo(0, scrollY);
}

function recordTouchStart(event: TouchEvent) {
  touchStartY = event.touches[0]?.clientY ?? 0;
}

function preventBackgroundTouchMove(event: TouchEvent) {
  if (!(event.target instanceof Element)) {
    event.preventDefault();
    return;
  }

  const scrollableElement = event.target.closest(scrollableSelector);

  if (!(scrollableElement instanceof HTMLElement)) {
    event.preventDefault();
    return;
  }

  const currentY = event.touches[0]?.clientY ?? touchStartY;
  const deltaY = currentY - touchStartY;
  const isAtTop = scrollableElement.scrollTop <= 0;
  const isAtBottom =
    scrollableElement.scrollTop + scrollableElement.clientHeight >=
    scrollableElement.scrollHeight - 1;

  if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
    event.preventDefault();
  }
}

export function useScrollLock(active: boolean, mediaQuery?: string) {
  useEffect(() => {
    if (!active || !shouldLock(mediaQuery)) {
      return;
    }

    lockScroll();

    return () => {
      unlockScroll();
    };
  }, [active, mediaQuery]);
}
