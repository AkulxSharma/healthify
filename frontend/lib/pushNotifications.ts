export const isPushSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

export const requestPushPermission = async (): Promise<NotificationPermission> => {
  if (!isPushSupported()) {
    return "denied";
  }
  return Notification.requestPermission();
};
