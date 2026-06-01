import { NextResponse } from 'next/server';

export async function GET() {
  // Check if the backend was booted with a Gemini API key in its environment
  const hasEnvKey = !!process.env.GEMINI_API_KEY;
  return NextResponse.json({ has_api_key: hasEnvKey });
}
