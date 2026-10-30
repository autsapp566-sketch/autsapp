import { EvolutionSettings } from '@/components/admin/EvolutionSettings';
import type { EvolutionAdminStatus } from '@/components/admin/EvolutionSettings';
import { PageHeader } from '@/components/admin/ui';
import { Alert } from '@/components/auth/ui';
import { adminFetch } from '@/lib/adminApi';

export const metadata = { title: 'Evolution' };

export default async function AdminEvolutionPage() {
  const res = await adminFetch<EvolutionAdminStatus>('/evolution');

  return (
    <>
      <PageHeader
        title="Evolution API"
        subtitle="إعدادات واتساب المشتركة. العنوان والمفتاح يبقيان في متغيرات البيئة، وهنا تظهر الحالة ورابط الـ Webhook."
      />
      {res.ok ? <EvolutionSettings initial={res.data} /> : <Alert tone="error">{res.error}</Alert>}
    </>
  );
}
