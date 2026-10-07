const websiteRoutes = ["/about", "/help", "/contact", "/changelog", "/privacy", "/extension-privacy", "/blog"];

export function isWebsitePathname(pathname: string): boolean {
  return websiteRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
