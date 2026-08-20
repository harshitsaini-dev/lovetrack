import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/types/database";

type PartnerLike = Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;

function initials(partner: PartnerLike): string {
  const source = partner.full_name?.trim() || partner.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Avatar + name + email, shared by every pairing card. */
export function PartnerIdentity({ partner }: { partner: PartnerLike }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-10 shrink-0">
        {partner.avatar_url && (
          <AvatarImage
            src={partner.avatar_url}
            alt=""
            className="object-cover"
          />
        )}
        <AvatarFallback className="bg-accent text-xs text-accent-foreground">
          {initials(partner)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {partner.full_name ?? "LoveTrack user"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {partner.email}
        </p>
      </div>
    </div>
  );
}
