import { tGlobal } from '../i18n/runtime';

export const DEMO_WASH_NAME = 'Demo Car Wash Central';
export const DEMO_WASH_ADDRESS = '1 Example St, Moscow';
export const DEMO_POST_SERIALS = ['WP-POST-001', 'WP-POST-002'] as const;

export function isDemoWash(wash: { name: string; address?: string }): boolean {
  return wash.name === DEMO_WASH_NAME || wash.address === DEMO_WASH_ADDRESS;
}

export function isDemoPostSerial(serialNumber?: string): boolean {
  const serial = serialNumber?.trim() ?? '';
  return (DEMO_POST_SERIALS as readonly string[]).includes(serial);
}

export function getSetupSteps() {
  return [
    { id: 'welcome', label: tGlobal('setup.steps.welcome') },
    { id: 'infra', label: tGlobal('setup.steps.infra') },
    { id: 'wash', label: tGlobal('setup.steps.wash') },
    { id: 'posts', label: tGlobal('setup.steps.posts') },
    { id: 'currency', label: tGlobal('setup.steps.currency') },
    { id: 'mqtt', label: tGlobal('setup.steps.mqtt') },
    { id: 'refs', label: tGlobal('setup.steps.refs') },
    { id: 'done', label: tGlobal('setup.steps.done') },
  ] as const;
}

export const SETUP_STEPS = getSetupSteps();

export type SetupStepId = (typeof SETUP_STEPS)[number]['id'];
