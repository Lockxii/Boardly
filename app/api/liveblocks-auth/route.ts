import { Liveblocks } from "@liveblocks/node";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return new Response("Unauthorized", { status: 403 });
  }

  const { room } = await request.json();

  const sessionLiveblocks = liveblocks.prepareSession(
    session.user.id,
    { userInfo: { name: session.user.name || "Anonymous", picture: session.user.image } }
  );

  sessionLiveblocks.allow(room, sessionLiveblocks.FULL_ACCESS);

  const { status, body } = await sessionLiveblocks.authorize();
  return new Response(body, { status });
}
