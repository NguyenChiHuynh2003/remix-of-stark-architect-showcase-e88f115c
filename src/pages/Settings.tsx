import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
 import { Building2, User, Lock, Bell, Database, GitBranch, Upload, FileJson, AlertTriangle, Clock, Mail, Key, Save, RefreshCw } from "lucide-react";
 import { UserGuideExport } from "@/components/settings/UserGuideExport";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrgChartCanvas } from "@/components/settings/OrgChartCanvas";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("settings");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // User profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Company settings state
  const [companyName, setCompanyName] = useState("KBA.2018");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  
  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [projectNotifications, setProjectNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreData, setRestoreData] = useState<Record<string, unknown[]> | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup schedule state
  const [backupHour, setBackupHour] = useState("2");
  const [backupMinute, setBackupMinute] = useState("0");
  const [backupEmail, setBackupEmail] = useState("zhunter1501@gmail.com");
  const [resendApiKey, setResendApiKey] = useState("");
  const [showResendKey, setShowResendKey] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [loadingBackupSettings, setLoadingBackupSettings] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastBackupStatus, setLastBackupStatus] = useState<string | null>(null);
  const [lastBackupFile, setLastBackupFile] = useState<string | null>(null);
  const [lastBackupError, setLastBackupError] = useState<string | null>(null);
  const [lastScheduledAt, setLastScheduledAt] = useState<string | null>(null);

  useEffect(() => {
    checkAdminRole();
    loadUserProfile();
    loadBackupSettings();
  }, [user]);

  const loadBackupSettings = async () => {
    if (!user) return;
    setLoadingBackupSettings(true);
    try {
      const { data, error } = await supabase
        .from("backup_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (data && !error) {
        const row = data as any;
        setBackupHour(String(row.backup_hour));
        setBackupMinute(String(row.backup_minute));
        setBackupEmail(row.notification_email || "");
        setBackupEnabled(row.is_enabled ?? true);
        setResendApiKey(row.resend_api_key || "");

        setLastBackupAt(row.last_backup_at || null);
        setLastBackupStatus(row.last_backup_status || null);
        setLastBackupFile(row.last_backup_file || null);
        setLastBackupError(row.last_backup_error || null);
        setLastScheduledAt(row.last_scheduled_at || null);
      }
    } catch (e) {
      console.log("No backup settings found");
    } finally {
      setLoadingBackupSettings(false);
    }
  };

  const checkAdminRole = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    setIsAdmin(!!data);
    
    // Check if super admin (specific email)
    setIsSuperAdmin(user.email === "aaa@example.com");
  };

  const loadUserProfile = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    if (profile) {
      setFullName(profile.full_name || "");
    }
    
    setEmail(user.email || "");
  };

  const handleSectionChange = (section: string) => {
    if (section !== "settings") {
      // Navigate with section param to avoid reset to overview
      navigate(`/dashboard?section=${section}`);
    }
    setActiveSection(section);
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      toast.success("Cập nhật thông tin thành công!");
    } catch (error: any) {
      toast.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự!");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      
      toast.success("Đổi mật khẩu thành công!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompanySettings = async () => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền thực hiện thao tác này!");
      return;
    }

    setLoading(true);
    try {
      // Here you would save company settings to a company_settings table
      toast.success("Cập nhật thông tin công ty thành công!");
    } catch (error: any) {
      toast.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupDatabase = async () => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền thực hiện thao tác này!");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        throw new Error("Không tìm thấy phiên đăng nhập");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        }
      );
      
      const data = await response.json();
      const error = response.ok ? null : new Error(data?.error || "Request failed");

      if (error) throw error;

      if (data?.success) {
        // Download JSON file to user's computer
        if (data.backupData) {
          const jsonString = JSON.stringify(data.backupData, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.fileName || `backup-${new Date().toISOString()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        
        toast.success(`Backup thành công! Email đã gửi và file đã tải về: ${data.fileName}`);
      } else {
        throw new Error(data?.error || "Backup thất bại");
      }
    } catch (error: any) {
      toast.error("Lỗi backup: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSQL = async () => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền thực hiện thao tác này!");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Không tìm thấy phiên đăng nhập");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-database-sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || "Export failed");
      }

      const sqlContent = await response.text();
      const blob = new Blob([sqlContent], { type: "application/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kba2018-full-export-${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Xuất file SQL thành công!");
    } catch (error: any) {
      toast.error("Lỗi xuất SQL: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error("Vui lòng chọn file JSON!");
      return;
    }

    setRestoreFile(file);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate backup structure
      if (typeof data !== 'object' || data === null) {
        throw new Error("Invalid backup format");
      }
      
      setRestoreData(data);
      
      // Show summary
      const tables = Object.keys(data);
      const totalRecords = Object.values(data).reduce((sum: number, arr) => {
        return sum + (Array.isArray(arr) ? arr.length : 0);
      }, 0);
      
      toast.success(`Đã đọc file backup: ${tables.length} bảng, ${totalRecords} bản ghi`);
    } catch (error: any) {
      toast.error("Lỗi đọc file: " + error.message);
      setRestoreFile(null);
      setRestoreData(null);
    }
  };

  const handleRestoreDatabase = async () => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền thực hiện thao tác này!");
      return;
    }

    if (!restoreData) {
      toast.error("Vui lòng chọn file backup trước!");
      return;
    }

    const confirmed = window.confirm(
      "⚠️ CẢNH BÁO: Thao tác này sẽ ghi đè dữ liệu hiện tại!\n\n" +
      "Bạn có chắc chắn muốn khôi phục dữ liệu từ file backup không?"
    );

    if (!confirmed) return;

    setRestoreLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        throw new Error("Không tìm thấy phiên đăng nhập");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-database`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            backupData: restoreData,
            mode: "merge" 
          }),
        }
      );
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Request failed");
      }

      if (data?.success) {
        toast.success(
          `Khôi phục thành công! ${data.summary?.totalRecords || 0} bản ghi đã được xử lý`
        );
        
        // Reset state
        setRestoreFile(null);
        setRestoreData(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        throw new Error(data?.error || "Khôi phục thất bại");
      }
    } catch (error: any) {
      toast.error("Lỗi khôi phục: " + error.message);
    } finally {
      setRestoreLoading(false);
    }
  };

  const clearRestoreFile = () => {
    setRestoreFile(null);
    setRestoreData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
        <Sidebar activeSection={activeSection} setActiveSection={handleSectionChange} />
        
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader onNavigate={(section) => handleSectionChange(section)} />
          
          <main className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-auto">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Cài đặt</h1>
              <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
                Quản lý thông tin cá nhân và cài đặt hệ thống
              </p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
                <TabsTrigger value="profile" className="text-xs sm:text-sm py-2">
                  <User className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Hồ sơ</span>
                  <span className="xs:hidden">Hồ sơ</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="text-xs sm:text-sm py-2">
                  <Lock className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Bảo mật</span>
                  <span className="xs:hidden">Bảo mật</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="text-xs sm:text-sm py-2">
                  <Bell className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Thông báo</span>
                  <span className="sm:hidden">TB</span>
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="company" className="text-xs sm:text-sm py-2">
                    <Building2 className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Công ty</span>
                    <span className="sm:hidden">CT</span>
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger value="orgchart" className="text-xs sm:text-sm py-2">
                    <GitBranch className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Sơ đồ</span>
                    <span className="sm:hidden">SĐ</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">Thông tin cá nhân</CardTitle>
                    <CardDescription className="text-sm">
                      Cập nhật thông tin tài khoản của bạn
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Họ và tên</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nhập họ và tên"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email không thể thay đổi
                      </p>
                    </div>
                    <Button onClick={handleUpdateProfile} disabled={loading} className="w-full sm:w-auto">
                      {loading ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">Đổi mật khẩu</CardTitle>
                    <CardDescription className="text-sm">
                      Cập nhật mật khẩu để bảo mật tài khoản
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Mật khẩu mới</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                      />
                    </div>
                    <Button onClick={handleChangePassword} disabled={loading} className="w-full sm:w-auto">
                      {loading ? "Đang xử lý..." : "Đổi mật khẩu"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">Cài đặt thông báo</CardTitle>
                    <CardDescription className="text-sm">
                      Quản lý các thông báo bạn muốn nhận
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <Label className="text-sm">Thông báo email</Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Nhận thông báo qua email
                        </p>
                      </div>
                      <Switch
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <Label className="text-sm">Thông báo dự án</Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Nhận thông báo về cập nhật dự án
                        </p>
                      </div>
                      <Switch
                        checked={projectNotifications}
                        onCheckedChange={setProjectNotifications}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <Label className="text-sm">Thông báo nhiệm vụ</Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Nhận thông báo về nhiệm vụ được giao
                        </p>
                      </div>
                      <Switch
                        checked={taskNotifications}
                        onCheckedChange={setTaskNotifications}
                      />
                    </div>
                    <Button onClick={() => toast.success("Đã lưu cài đặt thông báo!")} className="w-full sm:w-auto">
                      Lưu cài đặt
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Company Tab (Admin only) */}
              {isAdmin && (
                <TabsContent value="company">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">Thông tin công ty</CardTitle>
                        <CardDescription className="text-sm">
                          Cập nhật thông tin công ty (Chỉ quản trị viên)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="companyName">Tên công ty</Label>
                          <Input
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Nhập tên công ty"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="companyAddress">Địa chỉ</Label>
                          <Input
                            id="companyAddress"
                            value={companyAddress}
                            onChange={(e) => setCompanyAddress(e.target.value)}
                            placeholder="Nhập địa chỉ công ty"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="companyPhone">Số điện thoại</Label>
                            <Input
                              id="companyPhone"
                              value={companyPhone}
                              onChange={(e) => setCompanyPhone(e.target.value)}
                              placeholder="Nhập số điện thoại"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="companyEmail">Email công ty</Label>
                            <Input
                              id="companyEmail"
                              type="email"
                              value={companyEmail}
                              onChange={(e) => setCompanyEmail(e.target.value)}
                              placeholder="Nhập email công ty"
                            />
                          </div>
                        </div>
                       <Button onClick={handleUpdateCompanySettings} disabled={loading} className="w-full sm:w-auto">
                         {loading ? "Đang lưu..." : "Lưu thông tin công ty"}
                       </Button>
                     </CardContent>
                   </Card>
 
                   {/* User Guide Export - Super Admin only */}
                   {isSuperAdmin && <UserGuideExport />}
 
                   {/* Backup & Restore Section - Super Admin only */}
                   {isSuperAdmin && (
                   <>
                   <Card>
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                          <Database className="w-5 h-5" />
                          Sao lưu dữ liệu
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Sao lưu toàn bộ 33 bảng dữ liệu hệ thống
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-6">
                        {/* Manual backup */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Sao lưu thủ công
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Tạo bản sao lưu ngay lập tức và tải về máy.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              onClick={handleBackupDatabase} 
                              disabled={loading}
                              variant="outline"
                              className="w-full sm:w-auto"
                            >
                              {loading ? "Đang backup..." : "Tạo bản sao lưu ngay (JSON)"}
                            </Button>
                            <Button 
                              onClick={handleExportSQL} 
                              disabled={loading}
                              variant="outline"
                              className="w-full sm:w-auto"
                            >
                              <Database className="w-4 h-4 mr-2" />
                              {loading ? "Đang xuất..." : "Xuất toàn bộ CSDL (.sql)"}
                            </Button>
                          </div>
                        </div>

                        <div className="border-t pt-6 space-y-4">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Sao lưu tự động
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Hệ thống sẽ tự động sao lưu hàng ngày vào thời gian đã chọn.
                          </p>
                          
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <Label className="text-sm">Bật sao lưu tự động</Label>
                              <p className="text-xs text-muted-foreground">
                                Tự động sao lưu mỗi ngày theo lịch
                              </p>
                            </div>
                            <Switch
                              checked={backupEnabled}
                              onCheckedChange={setBackupEnabled}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Giờ</Label>
                              <Select value={backupHour} onValueChange={setBackupHour}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Chọn giờ" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={String(i)}>
                                      {String(i).padStart(2, '0')}h 
                                      {i >= 0 && i < 6 ? " (đêm)" : i < 12 ? " (sáng)" : i < 18 ? " (chiều)" : " (tối)"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Phút</Label>
                              <Select value={backupMinute} onValueChange={setBackupMinute}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Chọn phút" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                                    <SelectItem key={m} value={String(m)}>
                                      {String(m).padStart(2, '0')} phút
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="backupEmail" className="flex items-center gap-2">
                                <Mail className="w-3 h-3" />
                                Email thông báo
                              </Label>
                              <Input
                                id="backupEmail"
                                type="email"
                                value={backupEmail}
                                onChange={(e) => setBackupEmail(e.target.value)}
                                placeholder="email@example.com"
                              />
                            </div>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-2">
                            Sao lưu sẽ thực hiện lúc <strong>{backupHour.padStart(2, '0')}:{backupMinute.padStart(2, '0')}</strong> (giờ Việt Nam) mỗi ngày
                          </p>

                          <div className="space-y-2">
                            <Label htmlFor="resendApiKey" className="flex items-center gap-2">
                              <Key className="w-3 h-3" />
                              Resend API Key
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="resendApiKey"
                                type={showResendKey ? "text" : "password"}
                                value={resendApiKey}
                                onChange={(e) => setResendApiKey(e.target.value)}
                                placeholder="re_xxxxxxxxxxxx"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowResendKey(!showResendKey)}
                              >
                                {showResendKey ? "Ẩn" : "Hiện"}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Lấy API key tại{" "}
                              <a 
                                href="https://resend.com/api-keys" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                resend.com/api-keys
                              </a>
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm">Trạng thái sao lưu tự động</Label>
                            <div className="space-y-2">
                              {lastScheduledAt ? (
                                <p className="text-sm text-muted-foreground">
                                  Lần cập nhật lịch gần nhất: <strong>{new Date(lastScheduledAt).toLocaleString("vi-VN")}</strong>
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Chưa có lịch tự động (hãy bấm “Lưu cấu hình sao lưu”).
                                </p>
                              )}

                              {lastBackupAt ? (
                                <Alert>
                                  <AlertTitle>
                                    Lần sao lưu gần nhất: {new Date(lastBackupAt).toLocaleString("vi-VN")}
                                  </AlertTitle>
                                  <AlertDescription>
                                    <div className="space-y-1">
                                      <p>
                                        Trạng thái: <strong>{lastBackupStatus || "unknown"}</strong>
                                      </p>
                                      {lastBackupFile && (
                                        <p>
                                          File: <strong>{lastBackupFile}</strong>
                                        </p>
                                      )}
                                      {lastBackupError && (
                                        <p className="text-sm text-muted-foreground">
                                          Chi tiết: {lastBackupError}
                                        </p>
                                      )}
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Chưa ghi nhận lần sao lưu tự động nào.
                                </p>
                              )}
                            </div>
                          </div>

                          <Button 
                            onClick={async () => {
                              setSavingSchedule(true);
                              try {
                                // Save to backup_settings table
                                const { data: existingSettings } = await supabase
                                  .from("backup_settings")
                                  .select("id")
                                  .limit(1)
                                  .single();

                                const settingsData: any = {
                                  backup_hour: parseInt(backupHour),
                                  backup_minute: parseInt(backupMinute),
                                  notification_email: backupEmail,
                                  is_enabled: backupEnabled,
                                  resend_api_key: resendApiKey || null,
                                };

                                let saveError;
                                if (existingSettings?.id) {
                                  const { error } = await supabase
                                    .from("backup_settings")
                                    .update(settingsData)
                                    .eq("id", existingSettings.id);
                                  saveError = error;
                                } else {
                                  const { error } = await supabase
                                    .from("backup_settings")
                                    .insert(settingsData);
                                  saveError = error;
                                }

                                if (saveError) throw saveError;

                                // Call backend function to create/update the actual daily schedule
                                // Send Vietnam time directly - edge function will convert to UTC for cron
                                const { data: sessionData } = await supabase.auth.getSession();
                                const token = sessionData?.session?.access_token;
                                
                                if (!token) {
                                  throw new Error("Không tìm thấy phiên đăng nhập");
                                }

                                const resp = await fetch(
                                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-backup-schedule`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${token}`,
                                      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                                    },
                                    body: JSON.stringify({
                                      hour: parseInt(backupHour), // Vietnam time
                                      minute: parseInt(backupMinute),
                                      email: backupEmail,
                                      enabled: backupEnabled,
                                      resendApiKey: resendApiKey || undefined,
                                    }),
                                  }
                                );

                                const respJson = await resp.json().catch(() => ({}));
                                if (!resp.ok) {
                                  throw new Error(respJson?.error || "Không thể cập nhật lịch sao lưu tự động");
                                }
                                if (!respJson?.success) {
                                  throw new Error(respJson?.error || "Cập nhật lịch thất bại");
                                }
                                
                                await loadBackupSettings();
                                
                                toast.success(`Đã lưu cấu hình! Sao lưu tự động lúc ${backupHour.padStart(2, '0')}:${backupMinute.padStart(2, '0')} hàng ngày`);
                              } catch (error: any) {
                                console.error("Save error:", error);
                                toast.error("Lỗi lưu cấu hình: " + error.message);
                              } finally {
                                setSavingSchedule(false);
                              }
                            }}
                            disabled={savingSchedule || loadingBackupSettings}
                            className="w-full sm:w-auto"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${savingSchedule ? 'animate-spin' : ''}`} />
                            {savingSchedule ? "Đang lưu..." : "Lưu cấu hình sao lưu"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                          <Upload className="w-5 h-5" />
                          Khôi phục dữ liệu
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Nhập file JSON backup để khôi phục dữ liệu
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Cảnh báo</AlertTitle>
                          <AlertDescription>
                            Thao tác khôi phục sẽ ghi đè dữ liệu hiện tại. Hãy chắc chắn bạn đã sao lưu trước khi thực hiện.
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-2">
                          <Label htmlFor="restoreFile">Chọn file backup (JSON)</Label>
                          <Input
                            id="restoreFile"
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="cursor-pointer"
                          />
                        </div>

                        {restoreData && (
                          <div className="bg-muted p-4 rounded-lg space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <FileJson className="w-4 h-4" />
                              <span>{restoreFile?.name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p><strong>Các bảng trong backup:</strong></p>
                              <ul className="list-disc list-inside">
                                {Object.entries(restoreData).map(([table, data]) => (
                                  <li key={table}>
                                    {table}: {Array.isArray(data) ? data.length : 0} bản ghi
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={clearRestoreFile}
                              className="text-xs"
                            >
                              Xóa file
                            </Button>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button 
                            onClick={handleRestoreDatabase} 
                            disabled={restoreLoading || !restoreData}
                            variant="destructive"
                            className="w-full sm:w-auto"
                          >
                            {restoreLoading ? "Đang khôi phục..." : "Khôi phục dữ liệu"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    </>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* Organization Chart Tab (Admin only) */}
              {isAdmin && (
                <TabsContent value="orgchart">
                  <OrgChartCanvas />
                </TabsContent>
              )}
            </Tabs>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}