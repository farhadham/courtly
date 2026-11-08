/**
 * Only same-origin paths are valid post-login destinations. Anything else
 * (absolute URLs, protocol-relative `//host`) falls back to the court list so
 * the login form cannot be used as an open redirect.
 */
export function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}
