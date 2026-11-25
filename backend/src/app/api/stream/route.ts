import { getBoard } from '@/lib/board';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events feed of the queue board (pushed every 3s).
 * Works on a long-running Node host (Docker). On Vercel, swap this for Supabase Realtime.
 */
export async function GET(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF', 'THERAPIST']);
  if ('error' in auth) return auth.error;

  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(await getBoard())}\n\n`));
        } catch {
          clearInterval(timer);
          controller.close();
        }
      };
      await push();
      timer = setInterval(push, 3000);
      req.signal.addEventListener('abort', () => {
        clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
