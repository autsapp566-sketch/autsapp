'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Stripe redirects the customer back a moment BEFORE its webhook has updated our database. While we
 * wait for the subscription to show up as paid, re-render the (server) page every few seconds.
 */
export function CheckoutPoller({ intervalMs = 3000, maxTries = 10 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  const tries = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tries.current += 1;
      router.refresh();
      if (tries.current >= maxTries) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, maxTries]);

  return null;
}
