import { auth } from '@/auth';
import { Pagination } from '@/components/admin/Pagination';
import { Card, PageHeader } from '@/components/admin/ui';
import { UsersFilters } from '@/components/admin/UsersFilters';
import { UsersTable } from '@/components/admin/UsersTable';
import { Alert } from '@/components/auth/ui';
import { adminFetch } from '@/lib/adminApi';
import type { UsersPage } from '@/lib/adminTypes';

export const metadata = { title: 'المستخدمون' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const ERRORS: Record<string, string> = {
  invalid: 'طلب غير صالح.',
  blocked: 'لا يمكن انتحال حساب معطّل — ارفع التعطيل أولاً.',
  forbidden: 'لا يمكن انتحال هذا الحساب (حسابك أو مدير منصة آخر).',
  failed: 'تعذّر بدء الانتحال. حاول مرة أخرى.',
};

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const search = one(sp.search).slice(0, 100);
  const status = one(sp.status).toUpperCase();
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const actionError = ERRORS[one(sp.error)] ?? '';

  const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);

  const [session, res] = await Promise.all([auth(), adminFetch<UsersPage>(`/users?${qs.toString()}`)]);

  return (
    <>
      <PageHeader title="المستخدمون" subtitle="كل الحسابات المسجّلة، اشتراكاتها وأرقام واتساب المرتبطة بها." />
      {actionError ? (
        <div className="mb-4">
          <Alert tone="error">{actionError}</Alert>
        </div>
      ) : null}
      <UsersFilters search={search} status={status} />
      {!res.ok ? (
        <Alert tone="error">{res.error}</Alert>
      ) : (
        <>
          {!res.data.evolutionAvailable ? (
            <div className="mb-4">
              <Alert tone="info">تعذّر الاستعلام من Evolution API — عدد الأرقام المتصلة غير متاح حالياً.</Alert>
            </div>
          ) : null}
          <Card className="overflow-hidden">
            <UsersTable users={res.data.users} currentUserId={session?.user?.id} evolutionAvailable={res.data.evolutionAvailable} />
            <Pagination
              page={res.data.page}
              pageSize={res.data.pageSize}
              total={res.data.total}
              params={{ ...(search ? { search } : {}), ...(status ? { status } : {}) }}
            />
          </Card>
        </>
      )}
    </>
  );
}
