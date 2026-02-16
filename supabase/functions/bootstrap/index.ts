import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

// Hardcoded super admin account - always available
const SUPER_ADMIN = {
  email: "aaa@example.com",
  password: "123456",
  fullName: "Super Administrator",
};

// Simple in-memory rate limiting (resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  record.count++;
  return false;
}

// Input validation functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && email.length <= 255 && emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

function isValidFullName(name: string): boolean {
  return typeof name === 'string' && name.length > 0 && name.length <= 100;
}

// Function to ensure super admin exists
// deno-lint-ignore no-explicit-any
async function ensureSuperAdmin(supabaseAdmin: any): Promise<{ exists: boolean; created: boolean; error?: string }> {
  try {
    // Check if super admin user already exists in auth
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return { exists: false, created: false, error: listError.message };
    }

    // deno-lint-ignore no-explicit-any
    const superAdminUser = existingUsers?.users?.find((u: any) => u.email === SUPER_ADMIN.email);

    if (superAdminUser) {
      // User exists, ensure role is admin
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id, role")
        .eq("user_id", superAdminUser.id)
        .maybeSingle();

      if (!existingRole) {
        // Create admin role
        await supabaseAdmin
          .from("user_roles")
          .insert([{ user_id: superAdminUser.id, role: "admin" }]);
        console.log("Admin role restored for super admin");
      } else if (existingRole.role !== "admin") {
        // Update to admin role
        await supabaseAdmin
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", superAdminUser.id);
        console.log("Super admin role upgraded to admin");
      }

      // Ensure profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", superAdminUser.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabaseAdmin
          .from("profiles")
          .insert([{ id: superAdminUser.id, full_name: SUPER_ADMIN.fullName }]);
        console.log("Profile restored for super admin");
      }

      return { exists: true, created: false };
    }

    // Create super admin user
    console.log("Creating hardcoded super admin user...");
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: SUPER_ADMIN.email,
      password: SUPER_ADMIN.password,
      email_confirm: true,
      user_metadata: {
        full_name: SUPER_ADMIN.fullName,
      },
    });

    if (createError) {
      console.error("Error creating super admin:", createError);
      return { exists: false, created: false, error: createError.message };
    }

    if (newUser.user) {
      // Create profile
      await supabaseAdmin
        .from("profiles")
        .insert([{ id: newUser.user.id, full_name: SUPER_ADMIN.fullName }]);

      // Create admin role
      await supabaseAdmin
        .from("user_roles")
        .insert([{ user_id: newUser.user.id, role: "admin" }]);

      console.log("Super admin created successfully:", newUser.user.id);
    }

    return { exists: true, created: true };
  } catch (error) {
    console.error("Error ensuring super admin:", error);
    return { exists: false, created: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get("x-forwarded-for") || 
                   req.headers.get("x-real-ip") || 
                   "unknown";

  // Check rate limit
  if (isRateLimited(clientIP)) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      }
    );
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

    // Always ensure super admin exists first
    const superAdminResult = await ensureSuperAdmin(supabaseAdmin);
    console.log("Super admin check:", superAdminResult);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      // If no body, just return super admin status
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: superAdminResult.created 
            ? "Super admin created successfully" 
            : "Super admin verified",
          superAdmin: {
            email: SUPER_ADMIN.email,
            exists: superAdminResult.exists,
            created: superAdminResult.created
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const { email, password, fullName } = body;

    // If email matches super admin, just return status
    if (email === SUPER_ADMIN.email) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Super admin account is always available",
          superAdmin: {
            email: SUPER_ADMIN.email,
            exists: superAdminResult.exists
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // For other users, check if we can create additional admins
    // Optional: Check for bootstrap token if configured
    const bootstrapToken = Deno.env.get("BOOTSTRAP_TOKEN");
    if (bootstrapToken) {
      const providedToken = req.headers.get("x-bootstrap-token");
      if (providedToken !== bootstrapToken) {
        console.warn(`Invalid bootstrap token attempt from IP: ${clientIP}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          }
        );
      }
    }

    // Validate all inputs
    if (!email || !isValidEmail(email)) {
      throw new Error("Invalid email format or email too long (max 255 characters)");
    }

    if (!password || !isValidPassword(password)) {
      throw new Error("Password must be between 6 and 128 characters");
    }

    if (fullName && !isValidFullName(fullName)) {
      throw new Error("Full name must be between 1 and 100 characters");
    }

    console.log(`Creating admin user: ${email}, IP: ${clientIP}`);

    // Create user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName?.trim() || "Admin",
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw createError;
    }

    console.log("User created:", newUser.user?.id);

    if (newUser.user) {
      // Create profile for the new user
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert([{
          id: newUser.user.id,
          full_name: fullName?.trim() || "Admin",
        }]);

      if (profileError) {
        console.error("Error creating profile:", profileError);
      } else {
        console.log("Profile created for user:", newUser.user.id);
      }

      // Create admin role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert([{
          user_id: newUser.user.id,
          role: "admin",
        }]);

      if (roleError) {
        console.error("Error creating role:", roleError);
      } else {
        console.log("Admin role assigned to user:", newUser.user.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin user created successfully",
        user: { id: newUser.user?.id, email: newUser.user?.email }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
