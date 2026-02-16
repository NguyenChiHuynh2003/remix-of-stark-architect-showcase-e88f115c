import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Package, Clock, Shield, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, isAfter, isBefore } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LowStockItem {
  id: string;
  product_code: string;
  product_name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
}

interface OverdueAllocation {
  id: string;
  expected_return_date: string;
  purpose: string;
  allocated_to_name?: string;
  asset_master_data?: {
    asset_id: string;
    asset_name: string;
  };
  allocated_to_profile?: {
    full_name: string;
  };
}

interface UpcomingReturnAllocation {
  id: string;
  expected_return_date: string;
  purpose: string;
  quantity: number;
  allocated_to_name?: string;
  asset_master_data?: {
    asset_id: string;
    asset_name: string;
  };
}

interface ExpiringGuarantee {
  id: string;
  guarantee_type: string;
  guarantee_number: string;
  expiry_date: string;
  guarantee_value: number;
  contracts?: {
    contract_number: string;
    client_name: string;
  };
}
export function LowStockAlerts() {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [overdueAllocations, setOverdueAllocations] = useState<OverdueAllocation[]>([]);
  const [upcomingReturns, setUpcomingReturns] = useState<UpcomingReturnAllocation[]>([]);
  const [expiringGuarantees, setExpiringGuarantees] = useState<ExpiringGuarantee[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  const fetchLowStock = async () => {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, product_code, product_name, stock_quantity, min_stock_level, unit");

    if (error) {
      console.error("Error fetching inventory:", error);
      return;
    }

    const lowStock = (data || []).filter(
      (item) =>
        Number(item.stock_quantity || 0) <= Number(item.min_stock_level || 0) && Number(item.min_stock_level || 0) > 0,
    );
    setLowStockItems(lowStock);
  };

  const fetchOverdueAllocations = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("asset_allocations")
      .select(
        `
        id, expected_return_date, purpose, allocated_to,
        asset_master_data(asset_id, asset_name)
      `,
      )
      .eq("status", "active")
      .not("expected_return_date", "is", null)
      .lt("expected_return_date", today);

    if (error) {
      console.error("Error fetching allocations:", error);
      return;
    }

    // Fetch profile names
    const userIds = [...new Set((data || []).map((a) => a.allocated_to))];
    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from("profiles").select("id, full_name").in("id", userIds);

      profilesMap = (profilesData || []).reduce(
        (acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    const allocationsWithProfiles = (data || []).map((allocation) => ({
      ...allocation,
      allocated_to_profile: profilesMap[allocation.allocated_to]
        ? { full_name: profilesMap[allocation.allocated_to] }
        : null,
    }));

    setOverdueAllocations(allocationsWithProfiles as any);

    // Update status to overdue
    for (const allocation of data || []) {
      await supabase.from("asset_allocations").update({ status: "overdue" }).eq("id", allocation.id);
    }
  };

  const fetchExpiringGuarantees = async () => {
    const today = new Date();
    const thirtyDaysLater = addDays(today, 30);

    const { data, error } = await supabase
      .from("contract_guarantees")
      .select(
        `
        id, guarantee_type, guarantee_number, expiry_date, guarantee_value,
        contracts(contract_number, client_name)
      `,
      )
      .gte("expiry_date", format(today, "yyyy-MM-dd"))
      .lte("expiry_date", format(thirtyDaysLater, "yyyy-MM-dd"))
      .order("expiry_date", { ascending: true });

    if (error) {
      console.error("Error fetching guarantees:", error);
      return;
    }

    setExpiringGuarantees((data as any) || []);
  };

  const fetchUpcomingReturns = async () => {
    const today = new Date();
    const sevenDaysLater = addDays(today, 7);

    const { data, error } = await supabase
      .from("asset_allocations")
      .select(
        `
        id, expected_return_date, purpose, quantity, allocated_to_name,
        asset_master_data(asset_id, asset_name)
      `,
      )
      .eq("status", "active")
      .not("expected_return_date", "is", null)
      .gte("expected_return_date", format(today, "yyyy-MM-dd"))
      .lte("expected_return_date", format(sevenDaysLater, "yyyy-MM-dd"))
      .order("expected_return_date", { ascending: true });

    if (error) {
      console.error("Error fetching upcoming returns:", error);
      return;
    }

    setUpcomingReturns((data as any) || []);
  };

  const sendReminderEmail = async () => {
    if (!recipientEmail) {
      toast.error("Vui lòng nhập địa chỉ email");
      return;
    }

    setSendingEmail(true);
    try {
      const response = await supabase.functions.invoke("send-asset-return-reminder", {
        body: { recipient_email: recipientEmail },
      });

      if (response.error) {
        throw response.error;
      }

      toast.success(`Đã gửi email nhắc nhở đến ${recipientEmail}`);
      setEmailDialogOpen(false);
      setRecipientEmail("");
    } catch (error: any) {
      console.error("Error sending reminder email:", error);
      toast.error("Lỗi khi gửi email: " + (error.message || "Vui lòng thử lại"));
    } finally {
      setSendingEmail(false);
    }
  };

  const fetchAllAlerts = async () => {
    setLoading(true);
    await Promise.all([fetchLowStock(), fetchOverdueAllocations(), fetchUpcomingReturns(), fetchExpiringGuarantees()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllAlerts();
  }, []);

  const totalAlerts =
    lowStockItems.length + overdueAllocations.length + upcomingReturns.length + expiringGuarantees.length;

  const getGuaranteeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      performance: "Bảo lãnh thực hiện",
      advance: "Bảo lãnh tạm ứng",
      warranty: "Bảo lãnh bảo hành",
      bid: "Bảo lãnh dự thầu",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={totalAlerts > 0 ? "border-orange-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Tổng Cảnh báo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalAlerts > 0 ? "text-orange-600" : ""}`}>{totalAlerts}</div>
          </CardContent>
        </Card>
        <Card className={lowStockItems.length > 0 ? "border-red-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Tồn kho Thấp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockItems.length > 0 ? "text-red-600" : ""}`}>
              {lowStockItems.length}
            </div>
          </CardContent>
        </Card>
        <Card className={overdueAllocations.length > 0 ? "border-yellow-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Quá hạn Hoàn trả
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueAllocations.length > 0 ? "text-yellow-600" : ""}`}>
              {overdueAllocations.length}
            </div>
          </CardContent>
        </Card>
        <Card className={expiringGuarantees.length > 0 ? "border-blue-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Bảo lãnh Sắp hết hạn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${expiringGuarantees.length > 0 ? "text-blue-600" : ""}`}>
              {expiringGuarantees.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => setEmailDialogOpen(true)}
          variant="outline"
          size="sm"
          disabled={upcomingReturns.length === 0}
        >
          <Mail className="h-4 w-4 mr-2" />
          Gửi Email Nhắc nhở
        </Button>
        <Button onClick={fetchAllAlerts} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="flex-wrap">
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sắp đến hạn ({upcomingReturns.length})
          </TabsTrigger>
          <TabsTrigger value="lowstock" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Tồn kho Thấp ({lowStockItems.length})
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Quá hạn ({overdueAllocations.length})
          </TabsTrigger>
          <TabsTrigger value="guarantees" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Bảo lãnh ({expiringGuarantees.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Tài sản Sắp đến hạn Hoàn trả (7 ngày)</span>
              </CardTitle>
              <CardDescription>Các tài sản sẽ đến hạn hoàn trả trong vòng 7 ngày tới</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã Tài sản</TableHead>
                      <TableHead>Tên Tài sản</TableHead>
                      <TableHead>Người sử dụng</TableHead>
                      <TableHead>Mục đích</TableHead>
                      <TableHead className="text-right">SL</TableHead>
                      <TableHead>Hạn hoàn trả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingReturns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-green-600">
                          Không có tài sản sắp đến hạn
                        </TableCell>
                      </TableRow>
                    ) : (
                      upcomingReturns.map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell className="font-medium">{allocation.asset_master_data?.asset_id}</TableCell>
                          <TableCell>{allocation.asset_master_data?.asset_name}</TableCell>
                          <TableCell>{allocation.allocated_to_name || "-"}</TableCell>
                          <TableCell>{allocation.purpose}</TableCell>
                          <TableCell className="text-right">{allocation.quantity}</TableCell>
                          <TableCell className="text-orange-600 font-medium">
                            {format(new Date(allocation.expected_return_date), "dd/MM/yyyy")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lowstock">
          <Card>
            <CardHeader>
              <CardTitle>Vật tư Tồn kho Thấp</CardTitle>
              <CardDescription>Các mặt hàng có số lượng tồn kho dưới mức tối thiểu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên Sản phẩm</TableHead>
                      <TableHead className="text-right">Tồn kho</TableHead>
                      <TableHead className="text-right">Mức Tối thiểu</TableHead>
                      <TableHead>Đơn vị</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-green-600">
                          Không có cảnh báo tồn kho
                        </TableCell>
                      </TableRow>
                    ) : (
                      lowStockItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_code}</TableCell>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {Number(item.stock_quantity).toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.min_stock_level).toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">Cần nhập thêm</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle>Tài sản Quá hạn Hoàn trả</CardTitle>
              <CardDescription>Các tài sản đã quá hạn hoàn trả nhưng chưa được thu hồi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã Tài sản</TableHead>
                      <TableHead>Tên Tài sản</TableHead>
                      <TableHead>Người sử dụng</TableHead>
                      <TableHead>Mục đích</TableHead>
                      <TableHead>Hạn hoàn trả</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueAllocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-green-600">
                          Không có tài sản quá hạn
                        </TableCell>
                      </TableRow>
                    ) : (
                      overdueAllocations.map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell className="font-medium">{allocation.asset_master_data?.asset_id}</TableCell>
                          <TableCell>{allocation.asset_master_data?.asset_name}</TableCell>
                          <TableCell>{allocation.allocated_to_profile?.full_name || "-"}</TableCell>
                          <TableCell>{allocation.purpose}</TableCell>
                          <TableCell className="text-red-600">
                            {format(new Date(allocation.expected_return_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">Quá hạn</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guarantees">
          <Card>
            <CardHeader>
              <CardTitle>Bảo lãnh Sắp hết hạn (30 ngày)</CardTitle>
              <CardDescription>Các bảo lãnh sẽ hết hạn trong vòng 30 ngày tới</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Số Bảo lãnh</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Hợp đồng</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead className="text-right">Giá trị</TableHead>
                      <TableHead>Ngày hết hạn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringGuarantees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-green-600">
                          Không có bảo lãnh sắp hết hạn
                        </TableCell>
                      </TableRow>
                    ) : (
                      expiringGuarantees.map((guarantee) => (
                        <TableRow key={guarantee.id}>
                          <TableCell className="font-medium">{guarantee.guarantee_number || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getGuaranteeTypeLabel(guarantee.guarantee_type)}</Badge>
                          </TableCell>
                          <TableCell>{guarantee.contracts?.contract_number || "-"}</TableCell>
                          <TableCell>{guarantee.contracts?.client_name || "-"}</TableCell>
                          <TableCell className="text-right">
                            {Number(guarantee.guarantee_value).toLocaleString("vi-VN")} ₫
                          </TableCell>
                          <TableCell className="text-orange-600">
                            {format(new Date(guarantee.expiry_date), "dd/MM/yyyy")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gửi Email Nhắc nhở</DialogTitle>
            <DialogDescription>
              Gửi email nhắc nhở về {upcomingReturns.length} tài sản sắp đến hạn hoàn trả trong 7 ngày tới.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient_email">Email người nhận</Label>
              <Input
                id="recipient_email"
                type="email"
                placeholder="example@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={sendReminderEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Gửi Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
