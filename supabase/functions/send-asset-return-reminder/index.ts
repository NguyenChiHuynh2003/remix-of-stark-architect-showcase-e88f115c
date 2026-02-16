import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface AssetReturnReminder {
  allocation_id: string;
  asset_name: string;
  asset_id: string;
  allocated_to_name: string;
  allocated_to_email?: string;
  expected_return_date: string;
  days_until_due: number;
  purpose: string;
  quantity: number;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  console.log("Asset return reminder function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    console.log("Checking for asset allocations due between", today.toISOString().split('T')[0], "and", sevenDaysFromNow.toISOString().split('T')[0]);

    // Fetch allocations with expected return date within 7 days
    const { data: allocations, error: allocationsError } = await supabase
      .from("asset_allocations")
      .select(`
        id,
        allocated_to,
        allocated_to_name,
        expected_return_date,
        purpose,
        quantity,
        asset_master_data (
          asset_id,
          asset_name
        )
      `)
      .eq("status", "active")
      .not("expected_return_date", "is", null)
      .gte("expected_return_date", today.toISOString().split('T')[0])
      .lte("expected_return_date", sevenDaysFromNow.toISOString().split('T')[0]);

    if (allocationsError) {
      console.error("Error fetching allocations:", allocationsError);
      throw allocationsError;
    }

    console.log(`Found ${allocations?.length || 0} allocations due soon`);

    if (!allocations || allocations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No allocations due soon", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const allocation of allocations) {
      // Get employee email if allocated_to exists
      let employeeEmail: string | null = null;
      
      if (allocation.allocated_to) {
        const { data: employee } = await supabase
          .from("employees")
          .select("full_name, user_id")
          .eq("id", allocation.allocated_to)
          .maybeSingle();

        if (employee?.user_id) {
          // Get profile or auth email
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", employee.user_id)
            .maybeSingle();
          
          // For now, we'll use a fallback approach since we can't directly access auth.users
          // In production, you'd want to store email in employees or profiles table
        }
      }

      // Get admin users to notify
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner (
            full_name
          )
        `)
        .eq("role", "admin");

      const expectedDate = new Date(allocation.expected_return_date);
      const daysUntilDue = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const assetData = allocation.asset_master_data as unknown as { asset_id: string; asset_name: string } | null;
      const assetName = assetData?.asset_name || "Tài sản";
      const assetId = assetData?.asset_id || "";
      const allocatedToName = allocation.allocated_to_name || "Nhân viên";

      // Send notification email to admins
      // Note: In production, you should store user emails in profiles table
      // For now, we'll create a notification record instead
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
            .label { font-weight: bold; color: #64748b; }
            .value { color: #1e293b; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">📦 Nhắc nhở hoàn trả tài sản</h2>
            </div>
            <div class="content">
              <div class="warning">
                ⚠️ <strong>Tài sản sắp đến hạn hoàn trả trong ${daysUntilDue} ngày!</strong>
              </div>
              
              <div class="info-row">
                <span class="label">Mã tài sản:</span>
                <span class="value">${assetId}</span>
              </div>
              <div class="info-row">
                <span class="label">Tên tài sản:</span>
                <span class="value">${assetName}</span>
              </div>
              <div class="info-row">
                <span class="label">Người nhận:</span>
                <span class="value">${allocatedToName}</span>
              </div>
              <div class="info-row">
                <span class="label">Số lượng:</span>
                <span class="value">${allocation.quantity}</span>
              </div>
              <div class="info-row">
                <span class="label">Mục đích:</span>
                <span class="value">${allocation.purpose}</span>
              </div>
              <div class="info-row">
                <span class="label">Ngày hoàn trả dự kiến:</span>
                <span class="value">${expectedDate.toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
            <div class="footer">
              <p>Email này được gửi tự động từ hệ thống quản lý tài sản.</p>
              <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết và xử lý.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Check request body for recipient email
      let recipientEmail: string | null = null;
      try {
        const body = await req.json();
        recipientEmail = body.recipient_email;
      } catch {
        // No body or invalid JSON
      }

      if (recipientEmail) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Asset Management <onboarding@resend.dev>",
            to: [recipientEmail],
            subject: `[Nhắc nhở] Tài sản ${assetName} sắp đến hạn hoàn trả`,
            html: emailHtml,
          });

          console.log("Email sent successfully:", emailResponse);
          emailsSent.push(allocation.id);
        } catch (emailError: any) {
          console.error("Error sending email for allocation:", allocation.id, emailError);
          errors.push(`${allocation.id}: ${emailError.message}`);
        }
      } else {
        console.log("No recipient email provided, skipping email send for allocation:", allocation.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Asset return reminder check completed",
        allocations_found: allocations.length,
        emails_sent: emailsSent.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-asset-return-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
