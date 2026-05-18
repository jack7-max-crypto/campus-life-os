"use client";

import { useEffect } from "react";

let lockCount = 0;
let scrollY = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> = {};
let previousHtmlOverflow = "";

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
    previousHtmlOverflow = documentElement.style.overflow;
    previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
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
  documentElement.style.overflow = previousHtmlOverflow;
  body.style.overflow = previousBodyStyles.overflow ?? "";
  body.style.position = previousBodyStyles.position ?? "";
  body.style.top = previousBodyStyles.top ?? "";
  body.style.left = previousBodyStyles.left ?? "";
  body.style.right = previousBodyStyles.right ?? "";
  body.style.width = previousBodyStyles.width ?? "";
  body.style.paddingRight = previousBodyStyles.paddingRight ?? "";
  window.scrollTo(0, scrollY);
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
