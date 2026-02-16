import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Eye, EyeOff, RotateCcw, Upload, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const STORAGE_KEY = "remembered_login";

const signInSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Emergency restore states
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreData, setRestoreData] = useState<Record<string, unknown[]> | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }

    // Load saved email only (never store passwords)
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { email: savedEmail } = JSON.parse(saved);
        setEmail(savedEmail || "");
        setRememberMe(true);
      } catch (error) {
        console.error("Failed to load saved email");
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = signInSchema.parse({ email, password });
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      // Save or clear email only (never store passwords)
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      toast.success("Đăng nhập thành công!");
      navigate("/dashboard");
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error && error.message?.includes("Invalid login credentials")) {
        toast.error("Email hoặc mật khẩu không đúng");
      } else {
        toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi đăng nhập");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Vui lòng chọn file JSON backup");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setRestoreData(data);
        setRestoreFile(file);
        toast.success(`Đã tải file: ${file.name}`);
      } catch {
        toast.error("File JSON không hợp lệ");
        setRestoreData(null);
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleEmergencyRestore = async () => {
    if (!restoreData || confirmText !== "confirm") {
      toast.error("Vui lòng chọn file backup và nhập 'confirm' để xác nhận");
      return;
    }

    setRestoreLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("restore-database", {
        body: {
          backupData: restoreData,
          mode: "merge",
          emergencyRestore: true,
          confirmText: confirmText,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Khôi phục thành công! ${data.summary.totalRecords} bản ghi từ ${data.summary.totalTables} bảng`);
        setShowRestoreDialog(false);
        setRestoreData(null);
        setRestoreFile(null);
        setConfirmText("");
      } else {
        throw new Error(data?.error || "Khôi phục thất bại");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Lỗi khôi phục: ${errorMessage}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  const resetRestoreDialog = () => {
    setShowRestoreDialog(false);
    setRestoreData(null);
    setRestoreFile(null);
    setConfirmText("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">KBA.2018</h1>
          </div>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <h2 className="text-xl font-semibold text-center">ĐĂNG NHẬP</h2>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  EMAIL
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  placeholder="email@kba2018.vn"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  MẬT KHẨU
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Ghi nhớ tài khoản
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 text-base"
                disabled={loading}
              >
                {loading ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>

      {/* Emergency Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={resetRestoreDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Khôi phục dữ liệu khẩn cấp
            </DialogTitle>
            <DialogDescription>
              Chức năng này cho phép khôi phục 100% dữ liệu từ file backup mà không cần đăng nhập.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>CẢNH BÁO:</strong> Thao tác này sẽ ghi đè dữ liệu hiện tại trong database. Chỉ sử dụng khi cần
                khôi phục khẩn cấp!
              </AlertDescription>
            </Alert>

            {/* File Input */}
            <div className="space-y-2">
              <Label>File backup JSON</Label>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
              <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {restoreFile ? restoreFile.name : "Chọn file backup"}
              </Button>
            </div>

            {/* Preview */}
            {restoreData && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-2">Dữ liệu trong file:</p>
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                  {Object.entries(restoreData).map(([table, records]) => (
                    <div key={table} className="text-xs">
                      <span className="font-medium">{table}:</span> {Array.isArray(records) ? records.length : 0} bản
                      ghi
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm Text */}
            <div className="space-y-2">
              <Label htmlFor="confirm-text">Xác nhận khôi phục</Label>
              <Input
                id="confirm-text"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Nhập 'confirm' để xác nhận"
              />
              <p className="text-xs text-muted-foreground">
                Nhập chữ <strong>confirm</strong> để xác nhận khôi phục dữ liệu
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetRestoreDialog}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleEmergencyRestore}
              disabled={!restoreData || confirmText !== "confirm" || restoreLoading}
            >
              {restoreLoading ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  Đang khôi phục...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Khôi phục dữ liệu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
