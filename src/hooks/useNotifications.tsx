import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Map notification types to required module edit permissions
const notificationTypeToModule: Record<string, string> = {
  guarantee_expiry: "overview",
  contract_expiry: "overview",
  birthday: "hr",
  employee_contract_expiry: "hr",
  asset_return_due: "inventory",
};

async function fetchUserRoleAndPermissions(userId: string) {
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();

  const role = roleData?.role || "user";
  const isAdmin = role === "admin";

  if (isAdmin) {
    return { isAdmin: true, canEditModules: [] as string[] };
  }

  const { data: permData } = await (supabase
    .from("user_permissions" as any)
    .select("can_edit_modules")
    .eq("user_id", userId)
    .maybeSingle() as any);

  return {
    isAdmin: false,
    canEditModules: (permData?.can_edit_modules || []) as string[],
  };
}

function canSeeType(type: string, isAdmin: boolean, canEditModules: string[]): boolean {
  if (isAdmin) return true;
  const mod = notificationTypeToModule[type];
  if (!mod) return false;
  return canEditModules.includes(mod);
}

export function useNotifications() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hasCheckedRef = useRef(false);

  const checkAndCreateNotifications = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch role directly to avoid stale closure issues
      const { isAdmin, canEditModules } = await fetchUserRoleAndPermissions(user.id);
      const canSee = (type: string) => canSeeType(type, isAdmin, canEditModules);

      const today = new Date();
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(today.getDate() + 7);
      const todayStr = today.toISOString().split("T")[0];
      const thirtyStr = thirtyDaysFromNow.toISOString().split("T")[0];
      const sevenStr = sevenDaysFromNow.toISOString().split("T")[0];

      // Check guarantees expiring soon
      if (canSee("guarantee_expiry")) {
        const { data: guarantees } = await supabase
          .from("contract_guarantees")
          .select(`*, contracts (contract_number, client_name)`)
          .gte("expiry_date", todayStr)
          .lte("expiry_date", thirtyStr);

        if (guarantees) {
          for (const g of guarantees) {
            await insertNotification(
              user.id,
              "Bảo lãnh sắp hết hạn",
              `Bảo lãnh ${g.guarantee_type} - ${g.contracts?.contract_number} sẽ hết hạn vào ${fmtDate(g.expiry_date)}`,
              "guarantee_expiry",
              g.id,
            );
          }
        }
      }

      // Check employee birthdays (within 7 days)
      if (canSee("birthday")) {
        const { data: employees } = await supabase.from("employees").select("*");
        if (employees) {
          for (const emp of employees) {
            if (emp.date_of_birth) {
              const bd = new Date(emp.date_of_birth);
              const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
              if (thisYear >= today && thisYear <= sevenDaysFromNow) {
                await insertNotification(
                  user.id,
                  "Sinh nhật nhân viên",
                  `${emp.full_name} sẽ có sinh nhật vào ${thisYear.toLocaleDateString("vi-VN")}`,
                  "birthday",
                  emp.id,
                );
              }
            }
          }
        }
      }

      // Check contracts expiring soon
      if (canSee("contract_expiry")) {
        const { data: contracts } = await supabase
          .from("contracts")
          .select("*")
          .gte("expiry_date", todayStr)
          .lte("expiry_date", thirtyStr);
        if (contracts) {
          for (const c of contracts) {
            await insertNotification(
              user.id,
              "Hợp đồng sắp hết hạn",
              `Hợp đồng ${c.contract_number} - ${c.client_name} sẽ hết hạn vào ${fmtDate(c.expiry_date)}`,
              "contract_expiry",
              c.id,
            );
          }
        }
      }

      // Check employee contracts expiring soon (within 30 days)
      if (canSee("employee_contract_expiry")) {
        const { data: empContracts } = await supabase
          .from("employee_contracts")
          .select(`*, employees (full_name, employee_code)`)
          .not("contract_end_date", "is", null)
          .gte("contract_end_date", todayStr)
          .lte("contract_end_date", thirtyStr);

        if (empContracts) {
          for (const c of empContracts) {
            const name = c.employees?.full_name || "Nhân viên";
            const code = c.employees?.employee_code ? ` (${c.employees.employee_code})` : "";
            await insertNotification(
              user.id,
              "Hợp đồng lao động sắp hết hạn",
              `Hợp đồng lao động của ${name}${code} sẽ hết hạn vào ${fmtDate(c.contract_end_date)}`,
              "employee_contract_expiry",
              c.id,
            );
          }
        }
      }

      // Check asset allocations with expected return date coming up (within 7 days)
      if (canSee("asset_return_due")) {
        const { data: returns } = await supabase
          .from("asset_allocations")
          .select(`*, asset_master_data (asset_id, asset_name)`)
          .eq("status", "active")
          .not("expected_return_date", "is", null)
          .gte("expected_return_date", todayStr)
          .lte("expected_return_date", sevenStr);

        if (returns) {
          for (const a of returns) {
            const assetName = a.asset_master_data?.asset_name || "Tài sản";
            const toName = a.allocated_to_name || "Nhân viên";
            await insertNotification(
              user.id,
              "Tài sản sắp đến hạn hoàn trả",
              `${assetName} được phân bổ cho ${toName} sẽ đến hạn hoàn trả vào ${fmtDate(a.expected_return_date)}`,
              "asset_return_due",
              a.id,
            );
          }
        }
      }

      // Fetch all unread notifications after creating
      await fetchUnread(user.id, isAdmin, canEditModules);
    } catch (error: any) {
      console.error("Error checking notifications:", error);
    }
  }, []);

  const fetchUnread = async (userId: string, isAdmin: boolean, canEditModules: string[]) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const filtered = (data || []).filter((n) => canSeeType(n.type, isAdmin, canEditModules));
      setNotifications(filtered);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    }
  };

  const markAllAsRead = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
      setNotifications([]);
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    checkAndCreateNotifications();
  }, [checkAndCreateNotifications]);

  return {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: checkAndCreateNotifications,
  };
}

// Helpers
function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

async function insertNotification(userId: string, title: string, message: string, type: string, referenceId: string) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    reference_id: referenceId,
  });
}
