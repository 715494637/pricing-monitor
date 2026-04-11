import { NextResponse } from 'next/server';

const API_URL = 'https://new2.882111.xyz/api/pricing';

export const revalidate = 300; // 5 min ISR

export async function GET() {
  try {
    const res = await fetch(API_URL, {
      headers: {
        'accept': 'application/json',
        'cache-control': 'no-store',
        'new-api-user': '1',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
