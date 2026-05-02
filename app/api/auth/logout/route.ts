// API : logout. Invalide la session et clear les cookies.

import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { isAuthEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true });
  }
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
