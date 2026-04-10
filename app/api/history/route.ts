import { NextResponse } from 'next/server';
import { PriceChange } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'history.json');

export async function GET() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    const history: PriceChange[] = JSON.parse(raw);
    return NextResponse.json({ success: true, history });
  } catch {
    return NextResponse.json({ success: true, history: [] });
  }
}
