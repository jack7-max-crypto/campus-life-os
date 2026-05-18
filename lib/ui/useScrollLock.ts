"use client";

import { useEffect } from "react";

let lockCount = 0;
let scrollY = 0;
let containerScrollTop = 0;
let lockedContainer: HTMLElement | null = null;
let previousBodyStyles: Partial<CSSStyleDeclaration> = {};
let previousHtmlStyles: Partial<CSSStyleDeclaration> = {};
let previousContainerStyles: Partial<CSSStyleDeclaration> = {};
let touchStartY = 0;
const scrollLockClassName = "is-scroll-locked";
const appScrollContainerSelector = "[data-app-scroll-container='true']";
const scrollableSelector = "[data-scroll-lock-scrollable='true']";

function shouldLock(mediaQuery?: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return mediaQuery ? window.matchMedia(mediaQuery).matches : true;
}

function lockScroll() {
  if (lockCount === 0) {
    const appScrollContainer = getMobileAppScrollContainer();

    if (appScrollContainer) {
      lockAppScrollContainer(appScrollContainer);
    } else {
      lockBodyScroll();
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

  if (lockedContainer) {
    unlockAppScrollContainer();
  } else {
    unlockBodyScroll();
  }

  document.removeEventListener("touchstart", recordTouchStart);
  document.removeEventListener("touchmove", preventBackgroundTouchMove);
  previousHtmlStyles = {};
  previousBodyStyles = {};
  previousContainerStyles = {};
  lockedContainer = null;
  scrollY = 0;
  containerScrollTop = 0;
  touchStartY = 0;
}

function getMobileAppScrollContainer() {
  if (!window.matchMedia("(max-width: 1023px)").matches) {
    return null;
  }

  return document.querySelector<HTMLElement>(appScrollContainerSelector);
}

function clearBodyLockStyles() {
  const { body, documentElement } = document;

  documentElement.classList.remove(scrollLockClassName);
  body.classList.remove(scrollLockClassName);
  documentElement.style.overflow = "";
  documentElement.style.height = "";
  documentElement.style.overscrollBehavior = "";
  documentElement.style.scrollBehavior = "";
  body.style.overflow = "";
  body.style.height = "";
  body.style.overscrollBehavior = "";
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.paddingRight = "";
}

function lockAppScrollContainer(container: HTMLElement) {
  clearBodyLockStyles();

  lockedContainer = container;
  containerScrollTop = container.scrollTop;
  previousContainerStyles = {
    overflow: container.style.overflow,
    overflowX: container.style.overflowX,
    overflowY: container.style.overflowY,
    overscrollBehavior: container.style.overscrollBehavior,
    scrollBehavior: container.style.scrollBehavior,
    touchAction: container.style.touchAction,
  };

  container.classList.add(scrollLockClassName);
  container.style.overflow = "hidden";
  container.style.overflowX = "hidden";
  container.style.overflowY = "hidden";
  container.style.overscrollBehavior = "none";
  container.style.scrollBehavior = "auto";
  container.style.touchAction = "none";
}

function unlockAppScrollContainer() {
  if (!lockedContainer) {
    return;
  }

  lockedContainer.classList.remove(scrollLockClassName);
  lockedContainer.style.overflow = previousContainerStyles.overflow ?? "";
  lockedContainer.style.overflowX = previousContainerStyles.overflowX ?? "";
  lockedContainer.style.overflowY = previousContainerStyles.overflowY ?? "";
  lockedContainer.style.overscrollBehavior = previousContainerStyles.overscrollBehavior ?? "";
  lockedContainer.style.scrollBehavior = previousContainerStyles.scrollBehavior ?? "";
  lockedContainer.style.touchAction = previousContainerStyles.touchAction ?? "";
  lockedContainer.scrollTop = containerScrollTop;
  clearBodyLockStyles();
}

function lockBodyScroll() {
  const { body, documentElement } = document;
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

  scrollY = window.scrollY;
  previousHtmlStyles = {
    overflow: documentElement.style.overflow,
    height: documentElement.style.height,
    overscrollBehavior: documentElement.style.overscrollBehavior,
    scrollBehavior: documentElement.style.scrollBehavior,
  };
  previousBodyStyles = {
    overflow: body.style.overflow,
    height: body.style.height,
    overscrollBehavior: body.style.overscrollBehavior,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
  };

  documentElement.classList.add(scrollLockClassName);
  body.classList.add(scrollLockClassName);
  documentElement.style.overflow = "hidden";
  documentElement.style.height = "100%";
  documentElement.style.overscrollBehavior = "none";
  documentElement.style.scrollBehavior = "auto";
  body.style.overflow = "hidden";
  body.style.height = "100%";
  body.style.overscrollBehavior = "none";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";

  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function unlockBodyScroll() {
  const { body, documentElement } = document;
  const restoreScrollY = scrollY;

  documentElement.classList.remove(scrollLockClassName);
  body.classList.remove(scrollLockClassName);
  documentElement.style.overflow = previousHtmlStyles.overflow ?? "";
  documentElement.style.height = previousHtmlStyles.height ?? "";
  documentElement.style.overscrollBehavior = previousHtmlStyles.overscrollBehavior ?? "";
  documentElement.style.scrollBehavior = previousHtmlStyles.scrollBehavior ?? "";
  body.style.overflow = previousBodyStyles.overflow ?? "";
  body.style.height = previousBodyStyles.height ?? "";
  body.style.overscrollBehavior = previousBodyStyles.overscrollBehavior ?? "";
  body.style.position = previousBodyStyles.position ?? "";
  body.style.top = previousBodyStyles.top ?? "";
  body.style.left = previousBodyStyles.left ?? "";
  body.style.right = previousBodyStyles.right ?? "";
  body.style.width = previousBodyStyles.width ?? "";
  body.style.paddingRight = previousBodyStyles.paddingRight ?? "";
  window.scrollTo(0, restoreScrollY);
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
