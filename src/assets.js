// Public assets must follow Vite's base path when hosted under a project URL.
export function assetUrl(path, base = import.meta.env?.BASE_URL ?? '/') {
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
}
