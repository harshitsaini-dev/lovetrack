"use client";

import { useActionState } from "react";
import { Bell, Clock, Globe, User } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import type { AuthFormState } from "@/lib/auth/actions";
import { updateProfileSettings } from "@/lib/profile/actions";
import { TIMEZONES, toTimeInputValue } from "@/lib/validation/profile";
import type { Profile } from "@/types/database";

const NOTIFICATIONS = [
  { name: "notifyCheckIn", label: "Check-in", field: "notify_check_in" },
  { name: "notifyLunch", label: "Lunch", field: "notify_lunch" },
  { name: "notifyCheckOut", label: "Check-out", field: "notify_check_out" },
  { name: "notifyLeave", label: "Leave updates", field: "notify_leave" },
] as const;

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    updateProfileSettings,
    null,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="flex items-center gap-2 text-base"
          >
            <User className="size-4 text-primary" aria-hidden />
            Profile
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Poora naam</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={profile.full_name ?? ""}
              autoComplete="name"
              autoCapitalize="words"
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={profile.email}
              disabled
              readOnly
              className="h-11"
              aria-describedby="email-hint"
            />
            <p id="email-hint" className="text-xs text-muted-foreground">
              Email badalne ke liye support se sampark karein.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="flex items-center gap-2 text-base"
          >
            <Clock className="size-4 text-primary" aria-hidden />
            Reminder
          </CardTitle>
          <CardDescription>
            Agar din ki activity adhoori reh jaaye, to hum aapko is waqt yaad
            dila denge.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notifyReminder" className="flex-1">
              Daily reminder bhejein
            </Label>
            <Switch
              id="notifyReminder"
              name="notifyReminder"
              defaultChecked={profile.notify_reminder}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminderTime">Reminder ka time</Label>
            <Input
              id="reminderTime"
              name="reminderTime"
              type="time"
              defaultValue={toTimeInputValue(profile.reminder_time)}
              required
              className="h-11"
              aria-describedby="reminder-hint"
            />
            <p id="reminder-hint" className="text-xs text-muted-foreground">
              Ye aapke apne timezone ka local time hai.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="timezone"
              className="flex items-center gap-1.5"
            >
              <Globe className="size-3.5" aria-hidden />
              Timezone
            </Label>
            {/*
              A native <select> rather than a styled dropdown: on phones this
              opens the OS picker, which is faster and more accessible.
            */}
            <select
              id="timezone"
              name="timezone"
              defaultValue={profile.timezone}
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="flex items-center gap-2 text-base"
          >
            <Bell className="size-4 text-primary" aria-hidden />
            Activity emails
          </CardTitle>
          <CardDescription>
            Kaunsi activity par aapko email mile, ye aap chunte hain.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {NOTIFICATIONS.map(({ name, label, field }) => (
            <div key={name} className="flex items-center justify-between gap-4">
              <Label htmlFor={name} className="flex-1">
                {label}
              </Label>
              <Switch
                id={name}
                name={name}
                defaultChecked={profile[field]}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <SubmitButton pendingLabel="Save ho raha hai...">
        Settings save karein
      </SubmitButton>
    </form>
  );
}
