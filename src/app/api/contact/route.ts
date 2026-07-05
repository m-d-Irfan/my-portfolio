import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Server-side validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields. Please fill in all inputs." },
        { status: 400 }
      );
    }

    // Email format regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format. Please provide a valid address." },
        { status: 400 }
      );
    }

    // Log the contact details on the backend server for debugging/monitoring
    console.log("=== New Portfolio Message received ===");
    console.log(`From Name: ${name}`);
    console.log(`From Email: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Message Body:\n${message}`);
    console.log("======================================");

    // Simulate database write or SMTP email relay latency (500ms)
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Return successful response
    return NextResponse.json(
      {
        message: "Message processed successfully!",
        data: { name, email, subject },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing contact message:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
