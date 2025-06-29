
import { NextResponse } from 'next/server';
import { suggestMedicalCodes, type SuggestMedicalCodesInput, type SuggestMedicalCodesOutput } from '@/ai/flows/suggest-medical-codes-flow';

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as SuggestMedicalCodesInput;

    if (!input.clinicalText) {
      return NextResponse.json({ error: 'Missing clinicalText in request body' }, { status: 400 });
    }

    const result: SuggestMedicalCodesOutput = await suggestMedicalCodes(input);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/ai/suggest-medical-codes:', error);
    return NextResponse.json({ error: error.message || 'Failed to suggest medical codes.' }, { status: 500 });
  }
}
