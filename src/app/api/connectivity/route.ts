/**
 * Tiny same-origin probe for offline detection.
 * Any HTTP response means the network reached Keepall; failures mean unreachable.
 */
export function GET() {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
