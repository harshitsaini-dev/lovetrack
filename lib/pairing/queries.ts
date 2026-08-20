import { createClient } from "@/lib/supabase/server";
import type {
  Pair,
  PairPermissions,
  Profile,
} from "@/types/database";

/** A pair joined with the other person and both sides' sharing choices. */
export type PairView = {
  pair: Pair;
  /** The other member of the pair. */
  partner: Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;
  /** True when the signed-in user sent the request. */
  isRequester: boolean;
  /** What the signed-in user shares with their partner. */
  mine: PairPermissions | null;
  /** What the partner shares back. Read-only from this side. */
  theirs: PairPermissions | null;
};

type PartnerRow = Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;

/**
 * Every pair the signed-in user is part of, in one round trip.
 *
 * RLS already limits the rows to pairs this user belongs to, so there is no
 * additional filtering to do here — the policy is the authorization, not
 * anything written below.
 */
/**
 * The name to use in a capture prompt.
 *
 * Takes the first accepted pairing. Almost everyone has exactly one; if
 * someone has more, greeting the earliest is better than greeting nobody.
 */
export async function getPrimaryPartnerName(): Promise<string | null> {
  // Accepted pairings only. Greeting someone who has not accepted the
  // request yet would be putting words in their mouth.
  const { accepted } = await getPairsForCurrentUser();

  return accepted[0]?.partner.full_name ?? null;
}

export async function getPairsForCurrentUser(): Promise<{
  accepted: PairView[];
  incoming: PairView[];
  outgoing: PairView[];
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty = { accepted: [], incoming: [], outgoing: [] };
  if (!user) return empty;

  const { data: pairs } = await supabase
    .from("pairs")
    .select("*")
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false });

  if (!pairs?.length) return empty;

  // Partner identities come from an RPC, not a profiles query: `profiles`
  // RLS deliberately restricts a user to their own row, so a direct select
  // returns nothing for the other person. The function exposes only the few
  // fields this page renders, and only for the caller's own pairs.
  const [{ data: partners }, { data: permissions }] = await Promise.all([
    supabase.rpc("get_pair_partners"),
    supabase
      .from("pair_permissions")
      .select("*")
      .in(
        "pair_id",
        pairs.map((p) => p.id),
      ),
  ]);

  const profileById = new Map<string, PartnerRow>(
    (partners ?? []).map((row) => [
      row.partner_id,
      {
        id: row.partner_id,
        full_name: row.full_name,
        email: row.email,
        avatar_url: row.avatar_url,
      },
    ]),
  );

  const toView = (pair: Pair): PairView | null => {
    const isRequester = pair.requester_id === user.id;
    const partnerId = isRequester ? pair.receiver_id : pair.requester_id;
    const partner = profileById.get(partnerId);

    // A partner profile can be missing if the account was just deleted and
    // the cascade has not caught up. Drop the row rather than render a
    // half-empty card.
    if (!partner) return null;

    const forPair = (permissions ?? []).filter((x) => x.pair_id === pair.id);

    return {
      pair,
      partner,
      isRequester,
      mine: forPair.find((x) => x.owner_id === user.id) ?? null,
      theirs: forPair.find((x) => x.owner_id === partnerId) ?? null,
    };
  };

  const views = pairs.map(toView).filter((v): v is PairView => v !== null);

  return {
    accepted: views.filter((v) => v.pair.status === "accepted"),
    incoming: views.filter(
      (v) => v.pair.status === "pending" && !v.isRequester,
    ),
    outgoing: views.filter((v) => v.pair.status === "pending" && v.isRequester),
  };
}
