import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Package,
  FileText,
  TrendingDown,
  ArrowLeftRight,
  MapPin,
  Wrench,
  Trash2,
  AlertTriangle,
  Box,
  Settings2,
} from "lucide-react";

interface AssetMasterDialogProps {
  open: boolean;
  onClose: () => void;
  editingAsset?: any;
}

const WAREHOUSE_OPTIONS = [
  "KHO BẢO HỘ LAO ĐỘNG",
  "KHO CÔNG CỤ DỤNG CỤ",
  "KHO HÀNG HÓA",
  "KHO NGUYÊN VẬT LIỆU",
  "KHO CHÍNH",
];

const ASSET_TYPE_OPTIONS = [
  { value: "equipment", label: "Thiết bị", description: "Máy móc, thiết bị có thể phân bổ và hoàn trả nhiều lần" },
  { value: "tools", label: "Công cụ dụng cụ", description: "Dụng cụ làm việc, có thể phân bổ và hoàn trả" },
  { value: "materials", label: "Vật tư", description: "Nguyên vật liệu, có thể tiêu hao hoặc hoàn trả một phần" },
];

export function AssetMasterDialog({
  open,
  onClose,
  editingAsset,
}: AssetMasterDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    asset_id: "",
    asset_name: "",
    asset_type: "materials",
    brand: "",
    unit: "",
    warehouse_name: "KHO CHÍNH",
    opening_quantity: "",
    opening_value: "",
    inbound_quantity: "",
    inbound_value: "",
    outbound_quantity: "",
    outbound_value: "",
    closing_quantity: "",
    closing_value: "",
    stock_quantity: "",
    is_consumable: false,
    notes: "",
  });

  // Related data states
  const [grnItems, setGrnItems] = useState<any[]>([]);
  const [ginItems, setGinItems] = useState<any[]>([]);
  const [depreciationSchedules, setDepreciationSchedules] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [disposals, setDisposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingAsset) {
      setFormData({
        asset_id: editingAsset.asset_id || "",
        asset_name: editingAsset.asset_name || "",
        asset_type: editingAsset.asset_type || "materials",
        brand: editingAsset.brand || "",
        unit: editingAsset.unit || "",
        warehouse_name: editingAsset.warehouse_name || "KHO CHÍNH",
        opening_quantity: editingAsset.opening_quantity?.toString() || "0",
        opening_value: editingAsset.opening_value?.toString() || "0",
        inbound_quantity: editingAsset.inbound_quantity?.toString() || "0",
        inbound_value: editingAsset.inbound_value?.toString() || "0",
        outbound_quantity: editingAsset.outbound_quantity?.toString() || "0",
        outbound_value: editingAsset.outbound_value?.toString() || "0",
        closing_quantity: editingAsset.closing_quantity?.toString() || editingAsset.stock_quantity?.toString() || "0",
        closing_value: editingAsset.closing_value?.toString() || "0",
        stock_quantity: editingAsset.stock_quantity?.toString() || "0",
        is_consumable: editingAsset.is_consumable || false,
        notes: editingAsset.notes || "",
      });
      fetchRelatedData(editingAsset.id);
    } else {
      resetForm();
      clearRelatedData();
    }
  }, [editingAsset, open]);

  const resetForm = () => {
    setFormData({
      asset_id: "",
      asset_name: "",
      asset_type: "materials",
      brand: "",
      unit: "",
      warehouse_name: "KHO CHÍNH",
      opening_quantity: "0",
      opening_value: "0",
      inbound_quantity: "0",
      inbound_value: "0",
      outbound_quantity: "0",
      outbound_value: "0",
      closing_quantity: "0",
      closing_value: "0",
      stock_quantity: "0",
      is_consumable: false,
      notes: "",
    });
  };

  const clearRelatedData = () => {
    setGrnItems([]);
    setGinItems([]);
    setDepreciationSchedules([]);
    setAllocations([]);
    setLocationHistory([]);
    setMaintenanceRecords([]);
    setDisposals([]);
  };

  const fetchRelatedData = async (assetId: string) => {
    setLoading(true);
    try {
      const [
        grnRes,
        ginRes,
        depRes,
        allocRes,
        locRes,
        maintRes,
        dispRes,
      ] = await Promise.all([
        supabase
          .from("grn_items")
          .select("*, goods_receipt_notes(*)")
          .eq("asset_master_id", assetId),
        supabase
          .from("gin_items")
          .select("*, goods_issue_notes(*)")
          .eq("asset_master_id", assetId),
        supabase
          .from("depreciation_schedules")
          .select("*")
          .eq("asset_master_id", assetId)
          .order("period_date", { ascending: false }),
        supabase
          .from("asset_allocations")
          .select("*, projects(name)")
          .eq("asset_master_id", assetId)
          .order("allocation_date", { ascending: false }),
        supabase
          .from("asset_location_history")
          .select("*")
          .eq("asset_master_id", assetId)
          .order("timestamp", { ascending: false }),
        supabase
          .from("maintenance_records")
          .select("*")
          .eq("asset_master_id", assetId)
          .order("maintenance_date", { ascending: false }),
        supabase
          .from("asset_disposals")
          .select("*")
          .eq("asset_master_id", assetId),
      ]);

      setGrnItems(grnRes.data || []);
      setGinItems(ginRes.data || []);
      setDepreciationSchedules(depRes.data || []);
      setAllocations(allocRes.data || []);
      setLocationHistory(locRes.data || []);
      setMaintenanceRecords(maintRes.data || []);
      setDisposals(dispRes.data || []);
    } catch (error) {
      console.error("Error fetching related data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate closing values
  const openingQty = parseFloat(formData.opening_quantity) || 0;
  const openingVal = parseFloat(formData.opening_value) || 0;
  const inboundQty = parseFloat(formData.inbound_quantity) || 0;
  const inboundVal = parseFloat(formData.inbound_value) || 0;
  const outboundQty = parseFloat(formData.outbound_quantity) || 0;
  const outboundVal = parseFloat(formData.outbound_value) || 0;
  const calculatedClosingQty = openingQty + inboundQty - outboundQty;
  const calculatedClosingVal = openingVal + inboundVal - outboundVal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.asset_name || !formData.asset_id) {
      toast.error("Vui lòng nhập mã hàng và tên hàng");
      return;
    }

    try {
      const closingQty = parseFloat(formData.closing_quantity) || calculatedClosingQty;
      const closingVal = parseFloat(formData.closing_value) || calculatedClosingVal;
      
      const dataToSave = {
        asset_id: formData.asset_id,
        sku: editingAsset?.sku || `SKU-${Date.now()}`,
        asset_name: formData.asset_name,
        asset_type: formData.asset_type as "equipment" | "tools" | "materials",
        brand: formData.brand || null,
        unit: formData.unit || null,
        warehouse_name: formData.warehouse_name,
        opening_quantity: parseFloat(formData.opening_quantity) || 0,
        opening_value: parseFloat(formData.opening_value) || 0,
        inbound_quantity: parseFloat(formData.inbound_quantity) || 0,
        inbound_value: parseFloat(formData.inbound_value) || 0,
        outbound_quantity: parseFloat(formData.outbound_quantity) || 0,
        outbound_value: parseFloat(formData.outbound_value) || 0,
        closing_quantity: closingQty,
        closing_value: closingVal,
        stock_quantity: closingQty,
        is_consumable: formData.is_consumable,
        notes: formData.notes || null,
        cost_center: "default",
        created_by: user?.id,
      };

      let error;
      if (editingAsset) {
        const { error: updateError } = await supabase
          .from("asset_master_data")
          .update(dataToSave)
          .eq("id", editingAsset.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("asset_master_data")
          .insert([dataToSave]);
        error = insertError;
      }

      if (error) throw error;

      toast.success(
        editingAsset ? "Cập nhật thành công" : "Thêm mới thành công"
      );
      onClose();
    } catch (error: any) {
      toast.error("Lỗi: " + error.message);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: vi });
  };

  const formatDateTime = (date: string) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: vi });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount || 0);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Đang phân bổ", variant: "default" },
      returned: { label: "Đã hoàn trả", variant: "secondary" },
      overdue: { label: "Quá hạn", variant: "destructive" },
    };
    const s = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getTypeInfo = (type: string) => {
    const info = ASSET_TYPE_OPTIONS.find(t => t.value === type);
    return info || ASSET_TYPE_OPTIONS[2];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-5xl h-[85vh] overflow-hidden flex flex-col p-3 sm:p-6">
        <DialogHeader className="pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            {formData.asset_type === "equipment" && <Settings2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />}
            {formData.asset_type === "tools" && <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />}
            {formData.asset_type === "materials" && <Box className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />}
            <span className="truncate">{editingAsset ? "Chỉnh sửa" : "Thêm mới"} - {getTypeInfo(formData.asset_type).label}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm truncate">
            {editingAsset 
              ? `Mã: ${editingAsset.asset_id} | Kho: ${editingAsset.warehouse_name || "KHO CHÍNH"}`
              : getTypeInfo(formData.asset_type).description
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0">
            <ScrollArea className="w-full">
              <TabsList className="inline-flex w-max min-w-full h-auto flex-wrap gap-1 p-1">
                <TabsTrigger value="info" className="text-[10px] sm:text-xs px-2 py-1.5">
                  <Package className="h-3 w-3 mr-1 hidden sm:block" />
                  Thông tin
                </TabsTrigger>
                {editingAsset && (
                  <>
                    <TabsTrigger value="grn" className="text-[10px] sm:text-xs px-2 py-1.5">
                      <FileText className="h-3 w-3 mr-1 hidden sm:block" />
                      Nhập ({grnItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="gin" className="text-[10px] sm:text-xs px-2 py-1.5">
                      <FileText className="h-3 w-3 mr-1 hidden sm:block" />
                      Xuất ({ginItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="allocation" className="text-[10px] sm:text-xs px-2 py-1.5">
                      <ArrowLeftRight className="h-3 w-3 mr-1 hidden sm:block" />
                      Phân bổ ({allocations.length})
                    </TabsTrigger>
                    <TabsTrigger value="location" className="text-[10px] sm:text-xs px-2 py-1.5">
                      <MapPin className="h-3 w-3 mr-1 hidden sm:block" />
                      Vị trí ({locationHistory.length})
                    </TabsTrigger>
                    <TabsTrigger value="maintenance" className="text-[10px] sm:text-xs px-2 py-1.5">
                      <Wrench className="h-3 w-3 mr-1 hidden sm:block" />
                      Bảo trì ({maintenanceRecords.length})
                    </TabsTrigger>
                    <TabsTrigger value="depreciation" className="text-[10px] sm:text-xs px-2 py-1.5">
                      <TrendingDown className="h-3 w-3 mr-1 hidden sm:block" />
                      Khấu hao
                    </TabsTrigger>
                    <TabsTrigger value="disposal" className="text-[10px] sm:text-xs px-2 py-1.5">
                      <Trash2 className="h-3 w-3 mr-1 hidden sm:block" />
                      Thanh lý
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </ScrollArea>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            {/* Tab Thông tin chính */}
            <TabsContent value="info" className="m-0 mt-0">
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                {/* Asset Type Selection */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {ASSET_TYPE_OPTIONS.map((option) => (
                    <Card 
                      key={option.value}
                      className={`cursor-pointer transition-all ${
                        formData.asset_type === option.value 
                          ? "border-primary ring-2 ring-primary/20" 
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setFormData({ 
                        ...formData, 
                        asset_type: option.value,
                        is_consumable: option.value === "materials" ? formData.is_consumable : false
                      })}
                    >
                      <CardContent className="p-2 sm:p-4 text-center">
                        <div className="flex justify-center mb-1 sm:mb-2">
                          {option.value === "equipment" && <Settings2 className="h-5 w-5 sm:h-8 sm:w-8 text-blue-500" />}
                          {option.value === "tools" && <Wrench className="h-5 w-5 sm:h-8 sm:w-8 text-green-500" />}
                          {option.value === "materials" && <Box className="h-5 w-5 sm:h-8 sm:w-8 text-orange-500" />}
                        </div>
                        <p className="font-semibold text-xs sm:text-sm">{option.label}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">{option.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Consumable Switch - Only for Materials */}
                {formData.asset_type === "materials" && (
                  <Card className="border-orange-200 bg-orange-50/50">
                    <CardContent className="p-2 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 shrink-0" />
                          <div className="min-w-0">
                            <Label className="font-medium text-xs sm:text-sm">Vật tư tiêu hao</Label>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">
                              Vật tư tiêu hao không cần hoàn trả toàn bộ
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.is_consumable}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_consumable: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="asset_id" className="text-xs sm:text-sm">
                      Mã hàng <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="asset_id"
                      value={formData.asset_id}
                      onChange={(e) => setFormData({ ...formData, asset_id: e.target.value.toUpperCase() })}
                      placeholder="VD: AOBH, NON..."
                      required
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="warehouse_name" className="text-xs sm:text-sm">Tên kho</Label>
                    <Select
                      value={formData.warehouse_name}
                      onValueChange={(value) => setFormData({ ...formData, warehouse_name: value })}
                    >
                      <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                        <SelectValue placeholder="Chọn kho" />
                      </SelectTrigger>
                      <SelectContent>
                        {WAREHOUSE_OPTIONS.map((warehouse) => (
                          <SelectItem key={warehouse} value={warehouse} className="text-xs sm:text-sm">{warehouse}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="asset_name" className="text-xs sm:text-sm">
                    Tên hàng <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="asset_name"
                    value={formData.asset_name}
                    onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                    placeholder="VD: Áo bảo hộ, Nón bảo hộ..."
                    required
                    className="h-8 sm:h-10 text-xs sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="brand" className="text-xs sm:text-sm">Nhãn hiệu</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="VD: 3M, INGCO..."
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="unit" className="text-xs sm:text-sm">ĐVT</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="Cái, Bộ, Kg..."
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="stock_quantity" className="text-xs sm:text-sm">Số lượng tồn</Label>
                    <Input
                      id="stock_quantity"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      placeholder="0"
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* Inventory Period Values - Display Only (Updated via GRN and Allocations) */}
                <Card>
                  <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center justify-between">
                      <span>Số liệu tồn kho theo kỳ</span>
                      <Badge variant="outline" className="text-[10px] font-normal">Chỉ đọc - Tự động cập nhật</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                      {/* Opening - Display Only */}
                      <div className="space-y-2 sm:space-y-3 p-2 sm:p-3 bg-muted/30 rounded-lg">
                        <Label className="text-[10px] sm:text-xs font-medium text-muted-foreground">ĐẦU KỲ</Label>
                        <div className="space-y-1 sm:space-y-2">
                          <div>
                            <Label className="text-[10px] sm:text-xs">SL</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-muted/50 rounded-md border">
                              {openingQty.toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <div>
                            <Label className="text-[10px] sm:text-xs">GT</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-muted/50 rounded-md border">
                              {openingVal.toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Inbound - Display Only */}
                      <div className="space-y-2 sm:space-y-3 p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200">
                        <Label className="text-[10px] sm:text-xs font-medium text-green-700">NHẬP</Label>
                        <div className="space-y-1 sm:space-y-2">
                          <div>
                            <Label className="text-[10px] sm:text-xs">SL</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-green-100/50 rounded-md border border-green-200 font-medium text-green-800">
                              {inboundQty.toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <div>
                            <Label className="text-[10px] sm:text-xs">GT</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-green-100/50 rounded-md border border-green-200 font-medium text-green-800">
                              {inboundVal.toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Outbound - Display Only */}
                      <div className="space-y-2 sm:space-y-3 p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200">
                        <Label className="text-[10px] sm:text-xs font-medium text-red-700">XUẤT</Label>
                        <div className="space-y-1 sm:space-y-2">
                          <div>
                            <Label className="text-[10px] sm:text-xs">SL</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-red-100/50 rounded-md border border-red-200 font-medium text-red-800">
                              {outboundQty.toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <div>
                            <Label className="text-[10px] sm:text-xs">GT</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-red-100/50 rounded-md border border-red-200 font-medium text-red-800">
                              {outboundVal.toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Closing - Display Only */}
                      <div className="space-y-2 sm:space-y-3 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Label className="text-[10px] sm:text-xs font-medium text-blue-700">CUỐI KỲ (Tự động)</Label>
                        <div className="space-y-1 sm:space-y-2">
                          <div>
                            <Label className="text-[10px] sm:text-xs">SL</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-blue-100/50 rounded-md border border-blue-200 font-medium text-blue-800">
                              {calculatedClosingQty.toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <div>
                            <Label className="text-[10px] sm:text-xs">GT</Label>
                            <div className="h-7 sm:h-8 px-3 flex items-center text-xs bg-blue-100/50 rounded-md border border-blue-200 font-medium text-blue-800">
                              {calculatedClosingVal.toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Calculated Summary */}
                    <div className="p-2 sm:p-3 bg-muted rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:justify-between text-[10px] sm:text-sm gap-1">
                        <span className="text-muted-foreground">Công thức: Cuối kỳ = Đầu kỳ + Nhập - Xuất</span>
                        <span className="font-medium">
                          Tính: {calculatedClosingQty.toLocaleString('vi-VN')} đv | {formatCurrency(calculatedClosingVal)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="notes" className="text-xs sm:text-sm">Ghi chú</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ghi chú thêm..."
                    rows={2}
                    className="text-xs sm:text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={onClose} className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">
                    Hủy
                  </Button>
                  <Button type="submit" className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">
                    {editingAsset ? "Cập nhật" : "Thêm mới"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Tab Phiếu nhập kho */}
            <TabsContent value="grn" className="m-0">
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3">
                  <CardTitle className="text-sm sm:text-base">Lịch sử nhập kho</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {grnItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Chưa có phiếu nhập kho</p>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Số phiếu</TableHead>
                            <TableHead className="text-xs">Ngày nhập</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">NCC</TableHead>
                            <TableHead className="text-xs text-right">SL</TableHead>
                            <TableHead className="text-xs text-right hidden sm:table-cell">Đơn giá</TableHead>
                            <TableHead className="text-xs text-right">Tiền</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grnItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium text-xs">{item.goods_receipt_notes?.grn_number}</TableCell>
                              <TableCell className="text-xs">{formatDate(item.goods_receipt_notes?.receipt_date)}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{item.goods_receipt_notes?.supplier || "-"}</TableCell>
                              <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                              <TableCell className="text-xs text-right hidden sm:table-cell">{formatCurrency(item.unit_cost)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(item.total_cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Phiếu xuất kho */}
            <TabsContent value="gin" className="m-0">
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3">
                  <CardTitle className="text-sm sm:text-base">Lịch sử xuất kho</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {ginItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Chưa có phiếu xuất kho</p>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Số phiếu</TableHead>
                            <TableHead className="text-xs">Ngày xuất</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Người nhận</TableHead>
                            <TableHead className="text-xs text-right">SL</TableHead>
                            <TableHead className="text-xs text-right hidden sm:table-cell">Đơn giá</TableHead>
                            <TableHead className="text-xs text-right">Tiền</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ginItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium text-xs">{item.goods_issue_notes?.gin_number}</TableCell>
                              <TableCell className="text-xs">{formatDate(item.goods_issue_notes?.issue_date)}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{item.goods_issue_notes?.recipient || "-"}</TableCell>
                              <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                              <TableCell className="text-xs text-right hidden sm:table-cell">{formatCurrency(item.unit_cost)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(item.total_cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Phân bổ */}
            <TabsContent value="allocation" className="m-0">
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3">
                  <CardTitle className="text-sm sm:text-base">Lịch sử phân bổ & hoàn trả</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {allocations.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Chưa có phân bổ</p>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Ngày</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Dự án</TableHead>
                            <TableHead className="text-xs text-right">SL</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Mục đích</TableHead>
                            <TableHead className="text-xs">TT</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Trả</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">TSD</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allocations.map((alloc) => (
                            <TableRow key={alloc.id}>
                              <TableCell className="text-xs">{formatDateTime(alloc.allocation_date)}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{alloc.projects?.name || "-"}</TableCell>
                              <TableCell className="text-xs text-right font-semibold">{alloc.quantity || 1}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{alloc.purpose}</TableCell>
                              <TableCell className="text-xs">
                                {getStatusBadge(alloc.status)}
                              </TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{formatDateTime(alloc.actual_return_date)}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{alloc.reusability_percentage ? `${alloc.reusability_percentage}%` : "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Lịch sử vị trí */}
            <TabsContent value="location" className="m-0">
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3">
                  <CardTitle className="text-sm sm:text-base">Lịch sử di chuyển vị trí</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {locationHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Chưa có lịch sử vị trí</p>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Thời gian</TableHead>
                            <TableHead className="text-xs">Vị trí</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Ghi chú</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {locationHistory.map((loc) => (
                            <TableRow key={loc.id}>
                              <TableCell className="text-xs">{formatDateTime(loc.timestamp)}</TableCell>
                              <TableCell className="text-xs font-medium">{loc.location}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{loc.notes || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Bảo trì */}
            <TabsContent value="maintenance" className="m-0">
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3">
                  <CardTitle className="text-sm sm:text-base">Lịch sử bảo trì</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {maintenanceRecords.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Chưa có bản ghi bảo trì</p>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Ngày</TableHead>
                            <TableHead className="text-xs">Loại</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Mô tả</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">NCC</TableHead>
                            <TableHead className="text-xs text-right">Chi phí</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {maintenanceRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="text-xs">{formatDate(record.maintenance_date)}</TableCell>
                              <TableCell className="text-xs font-medium">{record.maintenance_type}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{record.description || "-"}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{record.vendor || "-"}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(record.cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Khấu hao */}
            <TabsContent value="depreciation" className="m-0">
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3">
                  <CardTitle className="text-sm sm:text-base">Lịch khấu hao</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {depreciationSchedules.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Chưa có lịch khấu hao</p>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Kỳ</TableHead>
                            <TableHead className="text-xs text-right">KH kỳ</TableHead>
                            <TableHead className="text-xs text-right hidden sm:table-cell">KH lũy kế</TableHead>
                            <TableHead className="text-xs text-right">NBV</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">TT</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {depreciationSchedules.map((schedule) => (
                            <TableRow key={schedule.id}>
                              <TableCell className="text-xs font-medium">{formatDate(schedule.period_date)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(schedule.depreciation_amount)}</TableCell>
                              <TableCell className="text-xs text-right hidden sm:table-cell">{formatCurrency(schedule.accumulated_depreciation)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(schedule.nbv)}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant={schedule.is_processed ? "default" : "secondary"} className="text-[10px]">
                                  {schedule.is_processed ? "Đã xử lý" : "Chờ"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Thanh lý */}
            <TabsContent value="disposal" className="m-0">
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3">
                  <CardTitle className="text-sm sm:text-base">Thông tin thanh lý</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {disposals.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Chưa có thông tin thanh lý</p>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Ngày</TableHead>
                            <TableHead className="text-xs">Lý do</TableHead>
                            <TableHead className="text-xs text-right hidden sm:table-cell">NBV</TableHead>
                            <TableHead className="text-xs text-right">Giá bán</TableHead>
                            <TableHead className="text-xs text-right">Lãi/Lỗ</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Ghi chú</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {disposals.map((disp) => (
                            <TableRow key={disp.id}>
                              <TableCell className="text-xs">{formatDate(disp.disposal_date)}</TableCell>
                              <TableCell className="text-xs">{disp.disposal_reason}</TableCell>
                              <TableCell className="text-xs text-right hidden sm:table-cell">{formatCurrency(disp.nbv_at_disposal)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(disp.sale_price)}</TableCell>
                              <TableCell className={`text-xs text-right ${(disp.gain_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(disp.gain_loss)}
                              </TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{disp.notes || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
