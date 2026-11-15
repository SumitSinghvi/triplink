import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/server/session';

// Who is signed in on this browser (from the httpOnly session cookie).
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ userId: null }, { status: 401 });
  return NextResponse.json({ userId });
}
