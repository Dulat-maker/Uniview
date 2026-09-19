import type { NextRequest } from "next/server";
import type { ProfileEvent } from "@/lib/types";
import { NotFoundError, getProfile } from "@/lib/server/profile";

export const maxDuration = 30;

// Streams newline-delimited JSON: stage updates, then the finished profile.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/university/[qid]">) {
  const { qid } = await ctx.params;
  const lang = req.nextUrl.searchParams.get("lang") === "ru" ? "ru" : "en";
  if (!/^Q\d{1,12}$/.test(qid)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (event: ProfileEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false; // the browser went away; the pipeline still finishes and fills the cache
        }
      };
      try {
        const profile = await getProfile(qid, lang, (stage) => send({ type: "stage", stage }));
        send({ type: "result", profile });
      } catch (err) {
        if (err instanceof NotFoundError) {
          send({ type: "error", code: "not_found", message: "University not found" });
        } else {
          console.error("profile failed", qid, err);
          send({ type: "error", code: "upstream", message: "Open data sources did not respond" });
        }
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
