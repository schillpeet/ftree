// The chart's probes call this instead of rendering the home page; it does not touch the BFF, so a BFF outage keeps the UI up.
export function GET() {
  return new Response("ok", { headers: { "content-type": "text/plain" } });
}
