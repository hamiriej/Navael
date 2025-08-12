import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const key = process.env.SERVICE_ACCOUNT_KEY;

    if (!key) {
      return NextResponse.json({ valid: false, error: 'SERVICE_ACCOUNT_KEY not set' }, { status: 500 });
    }

    const decoded = Buffer.from(key, 'base64').toString('utf8');
    const json = JSON.parse(decoded);

    const hasPrivateKey = typeof json.private_key === 'string' && json.private_key.includes('BEGIN PRIVATE KEY');
    const hasClientEmail = typeof json.client_email === 'string';

    if (hasPrivateKey && hasClientEmail) {
      return NextResponse.json({ valid: true, message: 'SERVICE_ACCOUNT_KEY is valid and correctly formatted' });
    } else {
      return NextResponse.json({ valid: false, error: 'SERVICE_ACCOUNT_KEY JSON is missing required fields' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
  }
}
