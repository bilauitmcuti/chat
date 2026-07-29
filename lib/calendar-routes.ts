/** Calendar grid/list routes (homepage, program grid, list views). */
export function isCalendarListRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "/list") return true;
  if (/^\/[^/]+$/.test(pathname)) return true;
  if (/^\/[^/]+\/list$/.test(pathname)) return true;
  return false;
}
