import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const TABLES_TO_EXPORT = [
  "profiles", "user_roles", "user_permissions",
  "employees", "employee_contracts",
  "projects", "team_members", "tasks", "project_items", "project_kpis",
  "client_requirements", "materials",
  "organization_charts", "org_chart_positions", "org_chart_connections",
  "brands", "product_categories", "product_groups", "warehouses",
  "inventory_items", "asset_master_data", "asset_allocations",
  "asset_location_history", "asset_disposals", "asset_deletion_history",
  "depreciation_schedules", "maintenance_records",
  "goods_receipt_notes", "grn_items", "goods_issue_notes", "gin_items",
  "handover_slips", "contracts", "contract_guarantees",
  "accounting_transactions", "notifications", "backup_settings",
];

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const items = value.map((v) =>
      typeof v === "string" ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : String(v)
    );
    return `'{${items.join(",")}}'`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  const str = String(value).replace(/'/g, "''").replace(/\\/g, "\\\\");
  return `'${str}'`;
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
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use pg driver for schema queries
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(dbUrl, { max: 1 });

    const lines: string[] = [];
    const now = new Date().toISOString();

    lines.push("-- =============================================");
    lines.push("-- KBA2018 Full Database Export (Schema + Data)");
    lines.push(`-- Generated: ${now}`);
    lines.push("-- PostgreSQL compatible");
    lines.push("-- =============================================");
    lines.push("");

    // --- 1. Export custom ENUM types ---
    lines.push("-- =============================================");
    lines.push("-- ENUM TYPES");
    lines.push("-- =============================================");
    const enums = await sql`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as labels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname
    `;
    for (const en of enums) {
      const vals = (en.labels as string[]).map((l: string) => `'${l}'`).join(", ");
      lines.push(`DO $$ BEGIN`);
      lines.push(`  CREATE TYPE "${en.typname}" AS ENUM (${vals});`);
      lines.push(`EXCEPTION WHEN duplicate_object THEN NULL;`);
      lines.push(`END $$;`);
      lines.push("");
    }

    lines.push("");
    lines.push("BEGIN;");
    lines.push("");

    // --- 2. For each table: CREATE TABLE + constraints + data ---
    for (const table of TABLES_TO_EXPORT) {
      lines.push("-- -----------------------------------------------");
      lines.push(`-- Table: public.${table}`);
      lines.push("-- -----------------------------------------------");

      // Get columns
      const columns = await sql`
        SELECT column_name, data_type, udt_name, is_nullable, column_default,
               character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
        ORDER BY ordinal_position
      `;

      if (columns.length === 0) {
        lines.push(`-- Table ${table} not found in schema`);
        lines.push("");
        continue;
      }

      // Get primary key columns
      const pkCols = await sql`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = ${table} AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `;

      // Get unique constraints
      const uniqueCols = await sql`
        SELECT tc.constraint_name, array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as cols
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = ${table} AND tc.constraint_type = 'UNIQUE'
        GROUP BY tc.constraint_name
      `;

      // Build CREATE TABLE
      lines.push(`CREATE TABLE IF NOT EXISTS "public"."${table}" (`);
      const colDefs: string[] = [];
      for (const col of columns) {
        let typeName = col.udt_name;
        // Map common types
        if (col.data_type === "ARRAY") {
          typeName = `${col.udt_name.replace(/^_/, "")}[]`;
        } else if (col.data_type === "USER-DEFINED") {
          typeName = `"${col.udt_name}"`;
        } else if (col.data_type === "character varying") {
          typeName = col.character_maximum_length ? `varchar(${col.character_maximum_length})` : "varchar";
        } else if (col.data_type === "timestamp with time zone") {
          typeName = "timestamptz";
        } else if (col.data_type === "timestamp without time zone") {
          typeName = "timestamp";
        } else if (col.data_type === "boolean") {
          typeName = "boolean";
        } else if (col.data_type === "uuid") {
          typeName = "uuid";
        } else if (col.data_type === "text") {
          typeName = "text";
        } else if (col.data_type === "integer") {
          typeName = "integer";
        } else if (col.data_type === "numeric") {
          typeName = "numeric";
        } else if (col.data_type === "date") {
          typeName = "date";
        } else if (col.data_type === "jsonb") {
          typeName = "jsonb";
        } else if (col.data_type === "json") {
          typeName = "json";
        } else if (col.data_type === "bigint") {
          typeName = "bigint";
        } else if (col.data_type === "smallint") {
          typeName = "smallint";
        } else if (col.data_type === "real") {
          typeName = "real";
        } else if (col.data_type === "double precision") {
          typeName = "double precision";
        }

        let def = `  "${col.column_name}" ${typeName}`;
        if (col.is_nullable === "NO") def += " NOT NULL";
        if (col.column_default !== null) def += ` DEFAULT ${col.column_default}`;
        colDefs.push(def);
      }

      // Add PK
      if (pkCols.length > 0) {
        const pkList = pkCols.map((p: { column_name: string }) => `"${p.column_name}"`).join(", ");
        colDefs.push(`  PRIMARY KEY (${pkList})`);
      }

      // Add unique constraints
      for (const uc of uniqueCols) {
        const ucList = (uc.cols as string[]).map((c: string) => `"${c}"`).join(", ");
        colDefs.push(`  UNIQUE (${ucList})`);
      }

      lines.push(colDefs.join(",\n"));
      lines.push(");");
      lines.push("");
    }

    // --- 3. Foreign keys (separate ALTER TABLE to avoid order issues) ---
    lines.push("-- =============================================");
    lines.push("-- FOREIGN KEYS");
    lines.push("-- =============================================");

    for (const table of TABLES_TO_EXPORT) {
      const fks = await sql`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = ${table} AND tc.constraint_type = 'FOREIGN KEY'
      `;

      for (const fk of fks) {
        lines.push(
          `ALTER TABLE "public"."${table}" ADD CONSTRAINT "${fk.constraint_name}" ` +
          `FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_schema}"."${fk.foreign_table_name}"("${fk.foreign_column_name}") ON DELETE CASCADE;`
        );
      }
    }
    lines.push("");

    // --- 4. Indexes ---
    lines.push("-- =============================================");
    lines.push("-- INDEXES");
    lines.push("-- =============================================");
    const tableList = TABLES_TO_EXPORT.map(t => `'${t}'`).join(",");
    const indexes = await sql.unsafe(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN (${tableList})
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);
    for (const idx of indexes) {
      // Make index creation idempotent
      const def = (idx.indexdef as string).replace(/^CREATE (UNIQUE )?INDEX /i, 'CREATE $1INDEX IF NOT EXISTS ');
      lines.push(`${def};`);
    }
    lines.push("");

    // --- 5. Database Functions ---
    lines.push("-- =============================================");
    lines.push("-- DATABASE FUNCTIONS");
    lines.push("-- =============================================");
    const functions = await sql`
      SELECT p.proname as func_name, pg_get_functiondef(p.oid) as func_def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind IN ('f', 'p')
      ORDER BY p.proname
    `;
    for (const fn of functions) {
      lines.push(`-- Function: ${fn.func_name}`);
      lines.push(`${fn.func_def};`);
      lines.push("");
    }
    lines.push("");

    // --- 6. Triggers ---
    lines.push("-- =============================================");
    lines.push("-- TRIGGERS");
    lines.push("-- =============================================");
    const triggers = await sql`
      SELECT tgname, tgrelid::regclass as table_name,
             pg_get_triggerdef(t.oid) as trigger_def
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
      ORDER BY c.relname, t.tgname
    `;
    for (const trig of triggers) {
      lines.push(`-- Trigger: ${trig.tgname} on ${trig.table_name}`);
      lines.push(`DROP TRIGGER IF EXISTS "${trig.tgname}" ON ${trig.table_name};`);
      lines.push(`${trig.trigger_def};`);
      lines.push("");
    }
    lines.push("");

    // --- 7. RLS Policies ---
    lines.push("-- =============================================");
    lines.push("-- ROW LEVEL SECURITY (RLS) POLICIES");
    lines.push("-- =============================================");
    for (const table of TABLES_TO_EXPORT) {
      lines.push(`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY;`);
    }
    lines.push("");

    const policies = await sql`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `;
    for (const pol of policies) {
      const permissive = pol.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE';
      const roles = (pol.roles as string[]).join(', ');
      let policySQL = `CREATE POLICY "${pol.policyname}" ON "public"."${pol.tablename}"`;
      policySQL += ` AS ${permissive}`;
      policySQL += ` FOR ${pol.cmd}`;
      policySQL += ` TO ${roles}`;
      if (pol.qual) policySQL += ` USING (${pol.qual})`;
      if (pol.with_check) policySQL += ` WITH CHECK (${pol.with_check})`;
      policySQL += ';';
      lines.push(`DROP POLICY IF EXISTS "${pol.policyname}" ON "public"."${pol.tablename}";`);
      lines.push(policySQL);
      lines.push("");
    }
    lines.push("");

    // --- 8. Data ---
    lines.push("-- =============================================");
    lines.push("-- DATA");
    lines.push("-- =============================================");

    for (const table of TABLES_TO_EXPORT) {
      // Fetch all records via Supabase client (bypasses RLS with service role)
      let allRecords: Record<string, unknown>[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(table).select("*").range(from, from + batchSize - 1);
        if (error) {
          lines.push(`-- ERROR fetching ${table}: ${error.message}`);
          hasMore = false;
        } else if (data && data.length > 0) {
          allRecords = [...allRecords, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      lines.push(`-- Data: ${table} (${allRecords.length} records)`);

      if (allRecords.length === 0) {
        lines.push("");
        continue;
      }

      const cols = Object.keys(allRecords[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");

      // Use INSERT with ON CONFLICT for idempotent imports
      for (const record of allRecords) {
        const values = cols.map((col) => escapeSQL(record[col])).join(", ");
        lines.push(`INSERT INTO "public"."${table}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
      }
      lines.push("");
    }

    lines.push("COMMIT;");
    lines.push("");
    lines.push("-- End of full export");

    await sql.end();

    const sqlContent = lines.join("\n");

    return new Response(sqlContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="kba2018-full-export-${now.replace(/[:.]/g, "-")}.sql"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Export error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
