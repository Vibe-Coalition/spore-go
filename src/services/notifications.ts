import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const AGENT_COMPLETE_CHANNEL = 'agent-complete';
let configured = false;
let permissionChecked = false;
let permissionGranted = false;
let notificationsDisabled = false;
let notificationsModule: typeof import('expo-notifications') | null = null;

function isAndroidExpoGo(): boolean {
  return Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function notificationsSupported(): boolean {
  return Platform.OS !== 'web' && !isAndroidExpoGo() && !notificationsDisabled;
}

function disableNotifications(): void {
  notificationsDisabled = true;
  configured = true;
  permissionChecked = true;
  permissionGranted = false;
  notificationsModule = null;
}

function getNotifications(): typeof import('expo-notifications') | null {
  if (!notificationsSupported()) return null;
  if (notificationsModule) return notificationsModule;

  try {
    // Keep expo-notifications out of the Android Expo Go startup path. Expo Go
    // can throw/warn as soon as the module is loaded on SDK 53+ Android.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    notificationsModule = require('expo-notifications') as typeof import('expo-notifications');
    return notificationsModule;
  } catch {
    disableNotifications();
    return null;
  }
}

export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(AGENT_COMPLETE_CHANNEL, {
        name: 'Agent completions',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#c084fc',
      });
    }
  } catch {
    disableNotifications();
  }
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;

  const Notifications = getNotifications();
  if (!Notifications) {
    permissionChecked = true;
    permissionGranted = false;
    return false;
  }

  try {
    await configureNotifications();

    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted || existing.status === 'granted') {
      permissionChecked = true;
      permissionGranted = true;
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync();
    permissionChecked = true;
    permissionGranted = requested.granted || requested.status === 'granted';
    return permissionGranted;
  } catch {
    disableNotifications();
    return false;
  }
}

export function previewNotificationText(text: string, maxLength = 140): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export async function notifyAgentFinished({
  sessionId,
  sessionTitle,
  messagePreview,
}: {
  sessionId: string;
  sessionTitle: string;
  messagePreview?: string;
}): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const allowed = await ensureNotificationPermissions();
  if (!allowed) return;

  const body = messagePreview?.trim()
    || `Final response is ready in ${sessionTitle || 'this chat'}`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Spore finished',
        body,
        data: {
          sessionId,
          kind: 'agent-complete',
        },
      },
      trigger: null,
    });
  } catch {
    disableNotifications();
  }
}
