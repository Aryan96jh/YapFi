// Best-effort X (Twitter) task verification — PARKED.
// Task completion is currently self-reported (see app/api/tasks/verify).
// Re-enable when X_BEARER_TOKEN (pay-per-use credits) is set up.
// Real verification needs X API v2:
//  - resolve handle -> user id:        GET /2/users/by/username/:handle
//  - check like:                       GET /2/tweets/:id/liking_users
//  - check retweet:                    GET /2/tweets/:id/retweeted_by
// Comment verification needs conversation search (also elevated).
// On ANY failure (no token, non-2xx, missing data) we return ok:false and the
// caller falls back to clearly-labeled demo self-confirm.

const API = "https://api.x.com/2";

function postIdFromUrl(url: string): string | null {
  const m = url.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

async function xGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`x api ${res.status}`);
  return res.json();
}

export async function verifyXTask(
  handle: string,
  task: "like" | "comment" | "retweet",
  postUrl: string
): Promise<{ ok: boolean; note: string }> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { ok: false, note: "no X_BEARER_TOKEN" };
  const postId = postIdFromUrl(postUrl);
  if (!postId) return { ok: false, note: "launch post URL has no tweet id" };
  try {
    const user = (await xGet(
      `/users/by/username/${encodeURIComponent(handle.replace(/^@/, ""))}`,
      token
    )) as { data?: { id?: string } };
    const userId = user.data?.id;
    if (!userId) return { ok: false, note: "x handle not found" };

    if (task === "like" || task === "retweet") {
      const endpoint =
        task === "like"
          ? `/tweets/${postId}/liking_users`
          : `/tweets/${postId}/retweeted_by`;
      const data = (await xGet(`${endpoint}?max_results=100`, token)) as {
        data?: { id: string }[];
        meta?: { next_token?: string };
      };
      // NOTE: these endpoints are paginated and capped at 100/page on free
      // tiers; a full scan needs pagination + elevated access. Best effort only.
      const found = (data.data || []).some((u) => u.id === userId);
      return found
        ? { ok: true, note: "confirmed via X API" }
        : { ok: false, note: "not found in recent likers/retweeters (API limits apply)" };
    }

    // comment: search recent replies in the conversation (elevated access)
    const q = encodeURIComponent(`conversation_id:${postId} from:${handle.replace(/^@/, "")}`);
    const data = (await xGet(`/tweets/search/recent?query=${q}&max_results=10`, token)) as {
      meta?: { result_count?: number };
    };
    return (data.meta?.result_count || 0) > 0
      ? { ok: true, note: "confirmed via X API" }
      : { ok: false, note: "no reply found (API limits apply)" };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? e.message : "x api error" };
  }
}
