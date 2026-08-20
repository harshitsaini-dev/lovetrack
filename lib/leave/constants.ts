/**
 * Leave constants.
 *
 * These live here rather than beside the actions because a `"use server"`
 * module may only export async functions — everything else is rewritten
 * into a server-action stub on the client, so an exported array arrives as
 * something that is not an array. Splitting the plain values out is the fix.
 */

export const LEAVE_TYPES = ["casual", "sick", "personal", "holiday"] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: "Casual leave",
  sick: "Sick leave",
  personal: "Personal",
  holiday: "Holiday",
};
