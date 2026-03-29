import { NextResponse } from "next/server";
import { mockRepository } from "@/lib/services/repository/mock-repository";

export async function GET() {
  return NextResponse.json({ data: mockRepository.getIdeas() });
}
