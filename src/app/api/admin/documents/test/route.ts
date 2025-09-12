import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Documents API is working' });
}