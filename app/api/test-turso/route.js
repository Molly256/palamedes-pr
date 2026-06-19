import { createClient } from "@libsql/client";
import { NextResponse } from "next/server";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function GET() {
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS test_table (...)`);
    await client.execute({ sql: "INSERT INTO test_table (name) VALUES (?)", args: ["hello from turso"] });
    const result = await client.execute("SELECT * FROM test_table ORDER BY id DESC LIMIT 1");

    return NextResponse.json({ success: true, row: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}