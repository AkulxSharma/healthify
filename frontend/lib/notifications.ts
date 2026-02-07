import { safeFetch } from "@/lib/api";

export type NotificationPreferences = {
  email_enabled: boolean;
  push_enabled: boolean;
  alert_types: Record<string, boolean>;
  frequency: string;
};

export type AlertItem = {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  action_link: string | null;
  read: boolean;
  created_at: string;
};

const mockPreferences: NotificationPreferences = {
  email_enabled: true,
  push_enabled: false,
  alert_types: { risk: true, goals: true, swaps: true, wellness: true },
  frequency: "weekly",
};

const mockAlerts: AlertItem[] = [
  {
    id: "alert-1",
    alert_type: "goal",
    title: "Weekly goal streak",
    message: "You hit 4 of 5 goals this week.",
    action_link: "/dashboard",
    read: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-2",
    alert_type: "risk",
    title: "Recovery reminder",
    message: "Consider a lighter day to balance load.",
    action_link: "/risk",
    read: true,
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
];

export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  return safeFetch("/notifications/preferences", mockPreferences);
};

export const updateNotificationPreferences = async (payload: {
  email: boolean;
  push: boolean;
  alert_types: Record<string, boolean>;
}): Promise<NotificationPreferences> => {
  const mock: NotificationPreferences = {
    email_enabled: payload.email,
    push_enabled: payload.push,
    alert_types: payload.alert_types,
    frequency: mockPreferences.frequency,
  };
  return safeFetch("/notifications/preferences", mock, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

export const getAlerts = async (unread?: boolean): Promise<AlertItem[]> => {
  const url = unread ? "/alerts?unread=true" : "/alerts";
  const data = await safeFetch(url, mockAlerts);
  return unread ? data.filter((alert) => !alert.read) : data;
};

export const markAlertRead = async (id: string): Promise<void> => {
  await safeFetch(`/alerts/${id}/read`, null, { method: "POST" });
};
