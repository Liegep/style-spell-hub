import { useEffect } from "react";
import type { Lang } from "@/i18n/dict";
import { translateAppPhrase } from "@/i18n/app-text";

const TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title"];
const originalTextNodes = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<HTMLElement, Map<string, string>>();

export function AppTextTranslator({ language }: { language: Lang }) {
  useEffect(() => {
    const root = document.querySelector("[data-app-i18n-root]");
    if (!root) return;

    translateTree(root, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target, language);
          continue;
        }

        if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
          translateElementAttributes(mutation.target, language);
          continue;
        }

        mutation.addedNodes.forEach((node) => translateTree(node, language));
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}

function translateTree(node: Node, language: Lang) {
  if (shouldSkipSubtree(node)) return;

  if (node.nodeType === Node.TEXT_NODE) {
    translateTextNode(node, language);
    return;
  }

  if (node instanceof HTMLElement) {
    translateElementAttributes(node, language);
  }

  node.childNodes.forEach((child) => translateTree(child, language));
}

function translateTextNode(node: Node, language: Lang) {
  if (shouldSkipText(node) || !node.textContent) return;

  if (!originalTextNodes.has(node)) {
    originalTextNodes.set(node, node.textContent);
  }

  let original = originalTextNodes.get(node) ?? node.textContent;
  if (language === "en") {
    if (node.textContent !== original) node.textContent = original;
    return;
  }

  const current = node.textContent;
  const currentOriginalTranslation = translateAppPhrase(original, language);
  if (current !== original && current !== currentOriginalTranslation) {
    original = current;
    originalTextNodes.set(node, original);
  }

  const translated = translateAppPhrase(original, language);
  if (translated !== node.textContent) {
    node.textContent = translated;
  }
}

function translateElementAttributes(element: HTMLElement, language: Lang) {
  if (shouldSkipSubtree(element)) return;

  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    const value = element.getAttribute(attr);
    if (!value) continue;

    let originals = originalAttributes.get(element);
    if (!originals) {
      originals = new Map();
      originalAttributes.set(element, originals);
    }
    if (!originals.has(attr)) {
      originals.set(attr, value);
    }

    let original = originals.get(attr) ?? value;
    if (language === "en") {
      if (value !== original) element.setAttribute(attr, original);
      continue;
    }

    const currentOriginalTranslation = translateAppPhrase(original, language);
    if (value !== original && value !== currentOriginalTranslation) {
      original = value;
      originals.set(attr, original);
    }

    const translated = translateAppPhrase(original, language);
    if (translated !== value) {
      element.setAttribute(attr, translated);
    }
  }
}

function shouldSkipSubtree(node: Node) {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return Boolean(element?.closest("script, style, code, pre, [data-i18n-skip]"));
}

function shouldSkipText(node: Node) {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return Boolean(element?.closest("script, style, code, pre, textarea, input, [data-i18n-skip]"));
}
