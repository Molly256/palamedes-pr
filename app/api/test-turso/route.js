import { createClient } from "@libsql/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Create table if it doesn't exist
    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert a test row
    await client.execute({
      sql: "INSERT INTO test_table (name) VALUES (?)",
      args: ["hello from turso"]
    });

    // Read it back
    const result = await client.execute("SELECT * FROM test_table ORDER BY id DESC LIMIT 1");

    return NextResponse.json({
      success: true,
      row: result.rows[0]
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}