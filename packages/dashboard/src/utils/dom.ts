/**
 * Minimal DOM utilities for vanilla JS dashboard
 */

export function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function byQuery(selector: string): Element | null {
  return document.querySelector(selector);
}

export function byQueryAll(selector: string): Element[] {
  return Array.from(document.querySelectorAll(selector));
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
  }
  return el;
}

export function setText(el: HTMLElement, text: string): void {
  el.textContent = text;
}

export function setHTML(el: HTMLElement, html: string): void {
  el.innerHTML = html;
}

export function addClass(el: HTMLElement, ...classes: string[]): void {
  el.classList.add(...classes);
}

export function removeClass(el: HTMLElement, ...classes: string[]): void {
  el.classList.remove(...classes);
}

export function toggleClass(
  el: HTMLElement,
  className: string,
  force?: boolean
): void {
  el.classList.toggle(className, force);
}

export function show(el: HTMLElement): void {
  el.style.display = "";
}

export function hide(el: HTMLElement): void {
  el.style.display = "none";
}

export function on<K extends keyof HTMLElementEventMap>(
  el: HTMLElement,
  event: K,
  handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any
): () => void {
  el.addEventListener(event, handler);
  return () => el.removeEventListener(event, handler);
}
