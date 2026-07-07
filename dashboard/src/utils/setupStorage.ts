const VIEWER_ACK_PREFIX = 'wash_setup_viewer_ack_';
const WELCOME_SEEN_PREFIX = 'wash_welcome_seen_';

export function getViewerSetupAck(userId: string): boolean {
  return localStorage.getItem(`${VIEWER_ACK_PREFIX}${userId}`) === '1';
}

export function setViewerSetupAck(userId: string): void {
  localStorage.setItem(`${VIEWER_ACK_PREFIX}${userId}`, '1');
}

export function getWelcomeSeen(userId: string): boolean {
  return localStorage.getItem(`${WELCOME_SEEN_PREFIX}${userId}`) === '1';
}

export function setWelcomeSeen(userId: string): void {
  localStorage.setItem(`${WELCOME_SEEN_PREFIX}${userId}`, '1');
}
