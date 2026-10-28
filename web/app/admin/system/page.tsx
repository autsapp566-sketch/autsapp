import { HealthMonitor } from '@/components/admin/HealthMonitor';
import { PageHeader } from '@/components/admin/ui';
import { Alert } from '@/components/auth/ui';
import { adminFetch } from '@/lib/adminApi';
import type { SystemHealth } from '@/lib/adminTypes';

export const metadata = { title: 'صحة النظام' };

export default async function AdminSystemPage() {
  const res = await adminFetch<SystemHealth>('/health?refresh=1');

  return (
    <>
      <PageHeader title="صحة النظام" subtitle="مراقبة Evolution API (حاويات Docker) وقاعدة البيانات وRedis." />
      {res.ok ? <HealthMonitor initial={res.data} /> : <Alert tone="error">{res.error}</Alert>}
    </>
  );
}
