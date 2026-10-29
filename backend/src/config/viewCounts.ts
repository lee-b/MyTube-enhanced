// View-count display policy. Library view counts are an internal tracking
// signal; the UI shows watched/unwatched status instead unless the deployment
// explicitly opts back in via MYTUBE_SHOW_VIEW_COUNTS ("true" or "1").
export function parseShowViewCounts(rawValue: string | undefined): boolean {
  if (rawValue === undefined || rawValue === "") return false;
  return rawValue === "true" || rawValue === "1";
}

export function isViewCountDisplayEnabled(): boolean {
  return parseShowViewCounts(process.env.MYTUBE_SHOW_VIEW_COUNTS);
}
