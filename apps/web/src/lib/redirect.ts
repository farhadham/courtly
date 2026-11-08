const ORIGIN = 'http://courtly.local';

/**
 * Only same-origin paths are valid post-login destinations. Anything else
 * (absolute URLs, protocol-relative `//host`, and backslash variants such as
 * `/\host` that browsers treat as protocol-relative) falls back to the court
 * list so the login form cannot be used as an open redirect.
 */
export function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith('/')) {
    return '/';
  }

  try {
    const url = new URL(value, ORIGIN);

    if (url.origin !== ORIGIN) {
      return '/';
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
