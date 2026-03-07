import { NextRequest, NextResponse } from 'next/server';
import { listTrainingJobs, startTrainingJob } from '@/lib/server/shared-data-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const limitRaw = req.nextUrl.searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : 20;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 20;
  const status = req.nextUrl.searchParams.get('status') ?? undefined;
  return NextResponse.json(listTrainingJobs(safeLimit, status));
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }
  const input = payload as Record<string, unknown>;
  const created = startTrainingJob({
    dataset: input.dataset && typeof input.dataset === 'object' ? input.dataset as Record<string, unknown> : {},
    hyperparams: input.hyperparams && typeof input.hyperparams === 'object' ? input.hyperparams as Record<string, unknown> : {},
    export: input.export && typeof input.export === 'object' ? input.export as Record<string, unknown> : {},
  });
  return NextResponse.json(created, { status: 201 });
}
