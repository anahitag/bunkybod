import { searchAllFoods } from "@/lib/usda/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  const pageSize = parseInt(request.nextUrl.searchParams.get("pageSize") || "10");

  if (!query) {
    return NextResponse.json({ error: "query parameter required" }, { status: 400 });
  }

  try {
    const foods = await searchAllFoods(query, pageSize);
    return NextResponse.json({ foods });
  } catch (error) {
    console.error("Food search error:", error);
    return NextResponse.json(
      { error: "Failed to search foods" },
      { status: 500 }
    );
  }
}
