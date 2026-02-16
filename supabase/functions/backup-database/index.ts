import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";

function safeToString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// ALL tables to backup (ordered to respect relationships for restore)
const TABLES_TO_BACKUP = [
  // User-related tables (depends on auth.users)
  "profiles",
  "user_roles",
  "user_permissions",
  
  // Core business tables
  "employees",
  "projects",
  "team_members",
  "tasks",
  "project_items",
  "project_kpis",
  "client_requirements",
  "materials",
  
  // Organization charts
  "organization_charts",
  "org_chart_positions",
  "org_chart_connections",
  
  // Inventory management
  "brands",
  "product_categories",
  "product_groups",
  "warehouses",
  "inventory_items",
  "asset_master_data",
  "asset_allocations",
  "asset_location_history",
  "asset_disposals",
  "asset_deletion_history", // Added missing table
  "depreciation_schedules",
  "maintenance_records",
  "goods_receipt_notes",
  "grn_items",
  "handover_slips",
  
  // Accounting
  "contracts",
  "contract_guarantees",
  "accounting_transactions",
  
  // Notifications
  "notifications",
];

// Format currency
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
}

// Format date
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
}

// Generate employees table HTML
function generateEmployeesTable(employees: Record<string, unknown>[]): string {
  if (!employees || employees.length === 0) return "<p>Không có dữ liệu</p>";
  
  let html = `
    <table style="width:100%; border-collapse: collapse; margin: 10px 0; font-size: 12px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Họ tên</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Chức vụ</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Phòng ban</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">SĐT</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ngày vào</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  employees.forEach((emp, index) => {
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${emp.full_name || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${emp.position || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${emp.department || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${emp.phone || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(emp.date_joined as string)}</td>
      </tr>
    `;
  });
  
  html += "</tbody></table>";
  return html;
}

// Generate projects table HTML
function generateProjectsTable(projects: Record<string, unknown>[]): string {
  if (!projects || projects.length === 0) return "<p>Không có dữ liệu</p>";
  
  let html = `
    <table style="width:100%; border-collapse: collapse; margin: 10px 0; font-size: 12px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tên</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Trạng thái</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ưu tiên</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Địa điểm</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ngày bắt đầu</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ngày kết thúc</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ngân sách</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  projects.forEach((proj, index) => {
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${proj.name || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${proj.status || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${proj.priority || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${proj.location || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(proj.start_date as string)}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(proj.end_date as string)}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${formatCurrency(proj.budget as number)}</td>
      </tr>
    `;
  });
  
  html += "</tbody></table>";
  return html;
}

// Generate tasks table HTML
function generateTasksTable(tasks: Record<string, unknown>[]): string {
  if (!tasks || tasks.length === 0) return "<p>Không có dữ liệu</p>";
  
  let html = `
    <table style="width:100%; border-collapse: collapse; margin: 10px 0; font-size: 12px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tiêu đề</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Trạng thái</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ưu tiên</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Hạn</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tiến độ</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  tasks.forEach((task, index) => {
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${task.title || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${task.status || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${task.priority || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(task.due_date as string)}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${task.completion_percentage || 0}%</td>
      </tr>
    `;
  });
  
  html += "</tbody></table>";
  return html;
}

// Generate asset master table HTML
function generateAssetTable(assets: Record<string, unknown>[]): string {
  if (!assets || assets.length === 0) return "<p>Không có dữ liệu</p>";
  
  let html = `
    <table style="width:100%; border-collapse: collapse; margin: 10px 0; font-size: 12px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TS</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tên tài sản</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Loại</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Nguyên giá</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Trạng thái</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tồn kho</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  assets.forEach((asset, index) => {
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${asset.asset_id || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${asset.asset_name || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${asset.asset_type || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${formatCurrency(asset.cost_basis as number)}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${asset.current_status || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${asset.stock_quantity ?? 0}</td>
      </tr>
    `;
  });
  
  html += "</tbody></table>";
  return html;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role key for full access - bypasses RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load backup settings (email + resend key + scheduled auth token)
    const { data: settings } = await supabase
      .from("backup_settings")
      .select("notification_email, resend_api_key, cron_token")
      .limit(1)
      .maybeSingle();

    const notificationEmail = safeToString(settings?.notification_email) || "zhunter1501@gmail.com";
    const resendKeyFromDb = safeToString(settings?.resend_api_key);
    const cronToken = safeToString(settings?.cron_token);

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("Backup attempt without authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized: No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Allow scheduled invocation via cron_token; otherwise require admin user JWT
    const isCronCall = !!cronToken && token === cronToken;
    let actorLabel = "system";

    if (!isCronCall) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.warn("Backup attempt with invalid token");
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Admin role check
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        console.warn(`Backup attempt by non-admin user: ${user.id}`);
        return new Response(
          JSON.stringify({ error: "Forbidden: Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      actorLabel = user.id;
    }

    console.log(`Starting FULL database backup by ${isCronCall ? "cron" : "admin"} user: ${actorLabel}`);
    
    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];

    // Fetch ALL data from each table - no limits
    for (const table of TABLES_TO_BACKUP) {
      try {
        // Fetch all records without limit
        let allRecords: unknown[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .range(from, from + batchSize - 1);
          
          if (error) {
            errors.push(`Error fetching ${table}: ${error.message}`);
            console.error(`Error fetching ${table}:`, error.message);
            hasMore = false;
          } else if (data && data.length > 0) {
            allRecords = [...allRecords, ...data];
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        
        backupData[table] = allRecords;
        console.log(`Backed up ${table}: ${allRecords.length} records`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push(`Exception fetching ${table}: ${errorMessage}`);
        console.error(`Exception fetching ${table}:`, err);
        backupData[table] = [];
      }
    }

    // Add metadata
    const metadata = {
      backup_version: "2.0",
      backup_date: new Date().toISOString(),
      total_tables: TABLES_TO_BACKUP.length,
      total_records: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
      tables_backed_up: TABLES_TO_BACKUP,
    };

    const fullBackup = {
      _metadata: metadata,
      ...backupData,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `full-backup-${timestamp}.json`;
    const backupContent = JSON.stringify(fullBackup, null, 2);

    // Save to storage
    const { error: uploadError } = await supabase.storage
      .from("database-backups")
      .upload(fileName, backupContent, {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading to storage:", uploadError.message);
      errors.push(`Storage upload error: ${uploadError.message}`);
    } else {
      console.log(`Backup saved to storage: ${fileName}`);
    }

    // Update status tracking (best effort)
    try {
      const status = errors.length > 0 ? "success_with_errors" : "success";
      await supabase
        .from("backup_settings")
        .update({
          last_backup_at: new Date().toISOString(),
          last_backup_file: fileName,
          last_backup_status: status,
          last_backup_error: errors.length > 0 ? errors.join("\n") : null,
        })
        .neq("id", "00000000-0000-0000-0000-000000000000");
    } catch (e) {
      console.warn("Could not update backup_settings status", e);
    }

    // Generate summary counts
    const summaryHtml = TABLES_TO_BACKUP.map(
      (table) => `<li><strong>${table}:</strong> ${backupData[table]?.length || 0} bản ghi</li>`
    ).join("");

    // Generate detailed tables
    const employeesTable = generateEmployeesTable(backupData.employees as Record<string, unknown>[]);
    const projectsTable = generateProjectsTable(backupData.projects as Record<string, unknown>[]);
    const tasksTable = generateTasksTable(backupData.tasks as Record<string, unknown>[]);
    const assetTable = generateAssetTable(backupData.asset_master_data as Record<string, unknown>[]);

    // Generate signed URL for secure download (expires in 24 hours)
    let downloadLink = "";
    try {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("database-backups")
        .createSignedUrl(fileName, 86400); // 24 hours
      
      if (signedUrlData && !signedUrlError) {
        downloadLink = signedUrlData.signedUrl;
        console.log("Signed URL created for backup download");
      } else {
        console.warn("Could not create signed URL:", signedUrlError?.message);
      }
    } catch (urlError) {
      console.warn("Error creating signed URL:", urlError);
    }

    // Format timestamp for display in Vietnam timezone (UTC+7)
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const formattedTime = vietnamTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });
    const formattedDate = vietnamTime.toLocaleDateString("vi-VN", { timeZone: "UTC" });

    // Send email notification with detailed data
    try {
      const resend = new Resend(resendKeyFromDb || Deno.env.get("RESEND_API_KEY") || "");
      const emailResponse = await resend.emails.send({
        from: "KBA2018 Backup <onboarding@resend.dev>",
        to: [notificationEmail],
        subject: `[KBA2018] FULL Backup Database - ${formattedDate}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 100%; }
              h1 { color: #1e40af; }
              h2 { color: #1e40af; margin-top: 30px; border-bottom: 2px solid #1e40af; padding-bottom: 5px; }
              h3 { color: #374151; margin-top: 20px; }
              .download-btn { 
                display: inline-block; 
                background-color: #2563eb; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 6px; 
                margin: 15px 0;
              }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; }
              th { background-color: #f3f4f6; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              tr:nth-child(even) { background-color: #f9fafb; }
              .highlight { background-color: #dcfce7; padding: 10px; border-radius: 5px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h1>📊 BÁO CÁO FULL BACKUP DATABASE</h1>
            <div class="highlight">
              <strong>🔄 Đây là bản backup TOÀN BỘ database (${TABLES_TO_BACKUP.length} bảng)</strong>
            </div>
            <p><strong>Thời gian:</strong> ${formattedTime} ${formattedDate}</p>
            <p><strong>File backup:</strong> ${fileName}</p>
            <p><strong>Tổng số bản ghi:</strong> ${metadata.total_records}</p>
            
            <h2>📈 TỔNG QUAN TẤT CẢ ${TABLES_TO_BACKUP.length} BẢNG</h2>
            <ul>${summaryHtml}</ul>
            
            <h2>📋 CHI TIẾT DỮ LIỆU (MẪU)</h2>
            
            <h3>EMPLOYEES (${backupData.employees?.length || 0} bản ghi)</h3>
            ${employeesTable}
            
            <h3>PROJECTS (${backupData.projects?.length || 0} bản ghi)</h3>
            ${projectsTable}
            
            <h3>TASKS (${backupData.tasks?.length || 0} bản ghi)</h3>
            ${tasksTable}
            
            <h3>ASSET_MASTER_DATA (${backupData.asset_master_data?.length || 0} bản ghi)</h3>
            ${assetTable}
            
            ${errors.length > 0 ? `<h2 style="color: red;">⚠️ LỖI</h2><pre style="background: #fee2e2; padding: 10px; border-radius: 5px;">${errors.join("\n")}</pre>` : ""}
            
            ${downloadLink ? `
              <h2>📥 TẢI BACKUP</h2>
              <a href="${downloadLink}" class="download-btn">Tải Full Backup JSON</a>
              <p style="color: #666; font-size: 12px;">⏰ Link hết hạn sau 24 giờ</p>
            ` : ""}
            
            <hr style="margin-top: 30px;">
            <p style="color: #666; font-size: 12px;">
              File backup đã được lưu vào storage bucket: <strong>database-backups</strong><br>
              Đây là email tự động từ hệ thống KBA2018.
            </p>
          </body>
          </html>
        `,
      });
      console.log("Email sent successfully:", emailResponse);
    } catch (emailError: unknown) {
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      console.error("Error sending email:", emailError);
      errors.push(`Email error: ${errorMessage}`);

      // Persist email error (best effort)
      try {
        await supabase
          .from("backup_settings")
          .update({
            last_backup_status: "email_error",
            last_backup_error: errors.join("\n"),
          })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      } catch {
        // ignore
      }
    }

    // Return backup data for direct download
    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl: downloadLink || undefined,
        metadata,
        recordCounts: Object.fromEntries(
          Object.entries(backupData).map(([k, v]) => [k, v.length])
        ),
        backupData: fullBackup, // Include full backup data for client-side download
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Backup failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
