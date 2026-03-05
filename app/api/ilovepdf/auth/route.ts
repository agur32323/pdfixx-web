import { NextResponse } from "next/server";

export async function POST() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { error: "API key missing" },
      { status: 500 }
    );
  }

  const res = await fetch("https://api.ilovepdf.com/v1/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      public_key: publicKey,
    }),
  });

  const data = await res.json();

  return NextResponse.json(data);
}
