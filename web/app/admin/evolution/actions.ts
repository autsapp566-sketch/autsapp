'use server';

import { adminFetch } from '@/lib/adminApi';
import type { EvolutionAdminStatus } from '@/components/admin/EvolutionSettings';

export async function refreshEvolutionAction() {
  return adminFetch<EvolutionAdminStatus>('/evolution');
}

export async function saveEvolutionPublicUrlAction(appPublicUrl: string) {
  return adminFetch<{ appPublicUrl: string; message: string }>('/evolution/public-url', {
    method: 'POST',
    body: { appPublicUrl },
  });
}

export async function syncEvolutionWebhooksAction() {
  return adminFetch<{ message: string }>('/evolution/webhook-sync', {
    method: 'POST',
    body: {},
  });
}
