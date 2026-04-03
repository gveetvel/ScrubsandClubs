import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST() {
  try {
    const exportsDir = path.join(process.cwd(), "public", "rendered-exports");

    // Ensure directory exists so explorer doesn't error
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Windows specific command to open folder
    const command = `explorer.exe "${exportsDir}"`;

    exec(command, (error) => {
      if (error) {
        console.error("Failed to open exports folder:", error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Open exports error:", error);
    return NextResponse.json(
      { error: "Failed to open exports folder" },
      { status: 500 }
    );
  }
}
