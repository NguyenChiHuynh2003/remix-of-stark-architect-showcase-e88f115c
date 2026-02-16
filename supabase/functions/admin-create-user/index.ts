import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

// Input validation functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && email.length > 0 && email.length <= 255 && emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 100;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Decode JWT to get user ID without session validation
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    function base64UrlToString(base64Url: string): string {
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      // add required padding
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return atob(padded);
    }

    let payload: { sub?: string; exp?: number };
    try {
      const raw = base64UrlToString(parts[1]);
      payload = JSON.parse(raw);
    } catch (_e) {
      throw new Error("Invalid token payload");
    }

    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error("Token expired");
    }

    const userId = payload.sub;
    if (!userId) {
      throw new Error("User not found in token");
    }

    // Check if user has admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Unauthorized: Admin access required");
    }

    const { email, password, fullName, role } = await req.json();

    // Valid roles matching app_role enum
    const VALID_ROLES = ['admin', 'user', 'accountant', 'hr_admin', 'project_manager'];

    // Validate inputs
    if (!isValidEmail(email)) {
      throw new Error("Invalid email format");
    }
    if (!isValidPassword(password)) {
      throw new Error("Password must be between 6 and 128 characters");
    }
    if (!isValidName(fullName)) {
      throw new Error("Full name is required and must be less than 100 characters");
    }
    if (role && !VALID_ROLES.includes(role)) {
      throw new Error("Invalid role specified");
    }

    // Create user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) throw createError;

    // Update user role if specified (not default 'user')
    // NOTE: Creating a user can race with the handle_new_user trigger that inserts
    // a default role row. If we try to UPDATE before the row exists, it updates 0 rows.
    // So we do: UPDATE first → if nothing updated → INSERT.
    if (role && role !== "user" && newUser.user) {
      const targetUserId = newUser.user.id;

      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("user_roles")
        .update({ role })
        .eq("user_id", targetUserId)
        .select("id");

      if (updateError) {
        console.error("Error updating role:", updateError);
      } else if (!updatedRows || updatedRows.length === 0) {
        // Role row not created yet by trigger → insert it.
        const { error: insertError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: targetUserId, role });

        if (insertError) {
          console.error("Error inserting role:", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({ user: newUser }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
