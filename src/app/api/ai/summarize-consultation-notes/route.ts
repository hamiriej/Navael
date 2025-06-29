
import { NextResponse } from 'next/server';
import { summarizeConsultationNotes, type SummarizeConsultationNotesInput, type SummarizeConsultationNotesOutput } from '@/ai/flows/summarize-consultation-notes-flow';

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as SummarizeConsultationNotesInput;

    if (!input.notesToSummarize) {
      return NextResponse.json({ error: 'Missing notesToSummarize in request body' }, { status: 400 });
    }

    const result: SummarizeConsultationNotesOutput = await summarizeConsultationNotes(input);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/ai/summarize-consultation-notes:', error);
    return NextResponse.json({ error: error.message || 'Failed to summarize consultation notes.' }, { status: 500 });
  }
}
