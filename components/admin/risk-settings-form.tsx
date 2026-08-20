"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateRiskSettings } from "@/lib/admin/actions";
import type { AuthFormState } from "@/lib/auth/actions";
import type { SystemSettings } from "@/types/attendance";

type Field = {
  name: string;
  label: string;
  hint: string;
  value: number;
};

export function RiskSettingsForm({ settings }: { settings: SystemSettings }) {
  const [state, submit] = useActionState<AuthFormState, FormData>(
    updateRiskSettings,
    null,
  );

  const location: Field[] = [
    {
      name: "maxAccuracyM",
      label: "Reject se zyada accuracy (metres)",
      hint: "Isse kharaab reading turant reject hoti hai.",
      value: settings.max_accuracy_m,
    },
    {
      name: "warnAccuracyM",
      label: "Warning accuracy (metres)",
      hint: "Isse upar reading accept hoti hai par kam-confidence maani jaati hai.",
      value: settings.warn_accuracy_m,
    },
    {
      name: "maxFixAgeS",
      label: "Location kitni purani chal sakti hai (seconds)",
      hint: "Cached fix se koi wo jagah bhej sakta hai jahan wo ab nahi hai.",
      value: settings.max_fix_age_s,
    },
    {
      name: "maxSpeedKmh",
      label: "Plausible speed limit (km/h)",
      hint: "Do events ke beech isse tez movement asambhav maani jaati hai.",
      value: settings.max_speed_kmh,
    },
  ];

  const thresholds: Field[] = [
    {
      name: "riskFlagThreshold",
      label: "Flag threshold",
      hint: "Isse upar score par submission review ke liye flag hoti hai.",
      value: settings.risk_flag_threshold,
    },
    {
      name: "riskRejectThreshold",
      label: "Reject threshold",
      hint: "Isse upar score par submission count hi nahi hoti.",
      value: settings.risk_reject_threshold,
    },
  ];

  const points: Field[] = [
    {
      name: "pointsAccuracyLow",
      label: "Kam-confidence accuracy ke points",
      hint: "Warning limit se kharaab reading par kitne points lagein.",
      value: settings.points_accuracy_low,
    },
    {
      name: "pointsZeroDrift",
      label: "Zero GPS drift ke points",
      hint: "Pichhli reading se bilkul same coordinates. Jaan-boojhkar flag threshold se kam — WiFi positioning bilkul same value deti hai, isliye ye sabooot nahi, sirf ek ishaara hai.",
      value: settings.points_zero_drift,
    },
    {
      name: "pointsImplausibleSpeed",
      label: "Asambhav movement ke points",
      hint: "Do events ke beech speed limit se tez movement par.",
      value: settings.points_implausible_speed,
    },
  ];

  const timing: Field[] = [
    {
      name: "nonceTtlSeconds",
      label: "Capture ka time limit (seconds)",
      hint: "Photo lene aur location permission dene ke liye kaafi ho, par itna kam ki chura hua nonce bekaar rahe.",
      value: settings.nonce_ttl_seconds,
    },
    {
      name: "signedUrlTtlSeconds",
      label: "Signed media URL ki umar (seconds)",
      hint: "Link hi access hai — isliye chhota rakhein.",
      value: settings.signed_url_ttl_seconds,
    },
  ];

  const lunch: Field[] = [
    {
      name: "lunchMinSeconds",
      label: "Lunch video minimum (seconds)",
      hint: "Isse chhoti clip kuch sabit nahi karti.",
      value: settings.lunch_min_seconds,
    },
    {
      name: "lunchMaxSeconds",
      label: "Lunch video maximum (seconds)",
      hint: "Isse lambi clip wo storage hai jise koi dekhta nahi.",
      value: settings.lunch_max_seconds,
    },
    {
      name: "lunchMaxBytes",
      label: "Lunch video max size (bytes)",
      hint: "8000000 ≈ 8 MB.",
      value: settings.lunch_max_bytes,
    },
  ];

  function renderFields(fields: Field[]) {
    return fields.map(({ name, label, hint, value }) => (
      <div key={name} className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Input
          id={name}
          name={name}
          type="number"
          defaultValue={value}
          className="h-11"
          aria-describedby={`${name}-hint`}
        />
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>
    ));
  }

  return (
    <form action={submit} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Location checks
          </CardTitle>
          <CardDescription>
            LoveTrack me koi geofence nahi hai — check-in kahin se bhi ho sakta
            hai. Ye settings sirf ye tay karti hain ki reading{" "}
            <em>believable</em> hai ya nahi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(location)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Score thresholds
          </CardTitle>
          <CardDescription>
            Flag threshold reject se kam hona chahiye, warna milder rule kabhi
            chalega hi nahi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderFields(thresholds)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Signal points
          </CardTitle>
          <CardDescription>
            Har signal kitna wazan rakhta hai. Ek signal jo akela flag
            threshold cross kar de, wo asal me ek verdict hai.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(points)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Timing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(timing)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Lunch video
          </CardTitle>
          <CardDescription>
            Free tier me sabse zyada jagah yahi khaata hai.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(lunch)}</CardContent>
      </Card>

      {/*
        Said plainly, because someone will look for the API keys here.
      */}
      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent className="py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Secrets yahan nahi hain.</strong>{" "}
            Resend API key, Supabase service-role key, cron secret aur R2
            credentials environment me hi rehte hain. Secret ko aisi table me
            rakhna jise admin padh sake, har admin session ko usse chura lene
            ka raasta bana deta hai — aur wo har database backup me chala
            jaata hai.
          </p>
        </CardContent>
      </Card>

      <SubmitButton pendingLabel="Save ho raha hai...">
        Settings save karein
      </SubmitButton>
    </form>
  );
}
