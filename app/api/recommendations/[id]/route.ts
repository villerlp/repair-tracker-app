import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

// GET single recommendation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get: (name: string) => {
          const cookie = request.cookies.get(name);
          return cookie?.value;
        },
        set: () => {},
        remove: () => {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching recommendation with id:", id);

    const { data, error } = await supabase
      .from("repair_recommendations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log("Found recommendation:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching recommendation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT (update) recommendation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get: (name: string) => {
          const cookie = request.cookies.get(name);
          return cookie?.value;
        },
        set: () => {},
        remove: () => {},
      },
    });

    console.log("PUT request for id:", id);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("PUT auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("User authenticated:", user.id);

    const body = await request.json();
    const { recommendation_number, title, description, priority, status, due_date, inspection_date } = body;

    console.log("Updating recommendation:", id, body);

    const updateData: any = {
      title,
      description,
      priority,
      status,
      due_date,
      inspection_date,
      updated_at: new Date().toISOString(),
    };

    // Only include recommendation_number if provided
    if (recommendation_number) {
      // Check if this recommendation number already exists (excluding current record)
      const { data: existing, error: checkError } = await supabase
        .from("repair_recommendations")
        .select("id, recommendation_number")
        .eq("recommendation_number", recommendation_number)
        .neq("id", id)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking for duplicate rec #:", checkError);
      }

      if (existing) {
        return NextResponse.json(
          { error: `Recommendation number ${recommendation_number} is already in use. Please use a different number.` },
          { status: 409 }
        );
      }

      updateData.recommendation_number = recommendation_number;
    }

    const { data, error } = await supabase
      .from("repair_recommendations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log("Updated successfully:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating recommendation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE recommendation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get: (name: string) => {
          const cookie = request.cookies.get(name);
          return cookie?.value;
        },
        set: () => {},
        remove: () => {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("DELETE auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Deleting recommendation:", id, "by user:", user.id);

    const { error } = await supabase
      .from("repair_recommendations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // Ensure user can only delete their own recommendations

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log("Deleted successfully");
    return NextResponse.json({ success: true, message: "Recommendation deleted" });
  } catch (error) {
    console.error("Error deleting recommendation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
