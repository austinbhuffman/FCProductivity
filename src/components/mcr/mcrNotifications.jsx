import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { enrichCase, isFormSigned } from "./mcrUtils";

async function _runMCRNotifications(currentUser) {
  const [raw, existing] = await Promise.all([
    base44.entities.MCRCase.list("-created_date", 500).catch(() => []),
    base44.entities.Notification.filter({ user_id: currentUser.id }, "-created_date", 50).catch(() => []),
  ]);

  const enriched = raw.map(enrichCase);
  const userId = currentUser.id;
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const urgent = enriched.filter(
    c => c.case_status === "Active" && c._day >= 86 && !isFormSigned(c.form_status)
  );
  const lrdSoon = enriched.filter(
    c => c.case_status === "Active" && c._day >= 83 && c._day <= 85 && !isFormSigned(c.form_status)
  );

  const creates = [];

  if (urgent.length > 0) {
    const alreadySentToday = existing.some(
      n => n.title === "MCR: Form Action Needed" && n.created_date?.startsWith(todayStr)
    );
    if (!alreadySentToday) {
      creates.push(base44.entities.Notification.create({
        user_id: userId,
        title: "MCR: Form Action Needed",
        message: `${urgent.length} Medicare case${urgent.length > 1 ? "s" : ""} require LRD form action now (Day 86+): ${urgent.map(c => c.case_id).join(", ")}. Please review the MCR Benefit Tracker.`,
        type: "warning",
        action_url: "/MedicareTracker",
      }));
    }
  }

  if (lrdSoon.length > 0) {
    const alreadySentToday = existing.some(
      n => n.title === "MCR: LRD Form Due Soon" && n.created_date?.startsWith(todayStr)
    );
    if (!alreadySentToday) {
      creates.push(base44.entities.Notification.create({
        user_id: userId,
        title: "MCR: LRD Form Due Soon",
        message: `${lrdSoon.length} Medicare case${lrdSoon.length > 1 ? "s are" : " is"} within 3 days of requiring the LRD form: ${lrdSoon.map(c => c.case_id).join(", ")}.`,
        type: "warning",
        action_url: "/MedicareTracker",
      }));
    }
  }

  if (creates.length) await Promise.all(creates);
}

export function sendMCRNotifications() {
  // Defer entirely so it never blocks the initial page render
  setTimeout(async () => {
    const currentUser = await base44.auth.me().catch(() => null);
    if (!currentUser) return;
    await _runMCRNotifications(currentUser).catch(() => {});
  }, 3000);
}

// Called when a specific case first enters the urgent queue — notifies ALL users
export async function notifyAllUsersUrgentCase(caseId) {
  try {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const notifTitle = `🔴 MCR Urgent: ${caseId}`;

    // Check if we already sent this today (check against any user to avoid duplicates)
    const allUsers = await base44.entities.User.list();
    if (!allUsers.length) return;

    // Check first user's notifications for this case today to avoid duplicates
    const firstUserId = allUsers[0].id;
    const existingCheck = await base44.entities.Notification.filter({ user_id: firstUserId, title: notifTitle });
    const alreadySentToday = existingCheck.some(n => n.created_date?.startsWith(todayStr));
    if (alreadySentToday) return;

    // Send to all users
    await Promise.all(
      allUsers.map(u =>
        base44.entities.Notification.create({
          user_id: u.id,
          title: notifTitle,
          message: `Case ${caseId} has moved to Urgent: Form Action Needed (Day 86+). LRD form action is required immediately.`,
          type: "warning",
          action_url: "/MedicareTracker",
        })
      )
    );
  } catch (e) {
    // silent fail
  }
}