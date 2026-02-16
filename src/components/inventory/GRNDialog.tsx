import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Package,
  Calendar,
  Clock,
  FileText,
  Warehouse,
  Plus,
  Trash2,
  PlusCircle,
  Info,
  Building2,
  HardHat,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { formatCurrency as formatCurrencyUtil } from "@/lib/formatCurrency";
import {
  generateAssetCode,
  getAssetCodeDescription,
  CATEGORY_OPTIONS,
  type AssetCategory,
  type AssetLocation,
} from "@/lib/assetCodeGenerator";

interface GRNDialogProps {
  open: boolean;
  onClose: () => void;
  editingGRN?: any;
}

interface GRNItem {
  id: string;
  asset_id: string;
  asset_name: string;
  unit: string;
  opening_quantity: number;
  opening_value: number;
  inbound_quantity: number;
  inbound_value: number;
  closing_quantity: number;
  closing_value: number;
  warehouse_name: string;
  asset_master_id?: string;
  asset_type?: string;
  brand?: string;
  isNew?: boolean;
}

interface AssetMaster {
  id: string;
  asset_id: string;
  asset_name: string;
  unit: string;
  warehouse_name: string;
  stock_quantity: number;
  cost_basis: number;
}

const ASSET_TYPES = [
  { value: "tools", label: "Công cụ dụng cụ (CC)" },
  { value: "equipment", label: "Thiết bị (CC)" },
  { value: "materials", label: "Vật tư (VT)" },
];

interface WarehouseOption {
  id: string;
  name: string;
}

export function GRNDialog({ open, onClose, editingGRN }: GRNDialogProps) {
  const { user } = useAuth();
  const isViewMode = !!editingGRN;

  const [formData, setFormData] = useState({
    grn_number: "",
    receipt_date: new Date().toISOString().split("T")[0],
    receipt_time: new Date().toTimeString().slice(0, 5),
    notes: "",
    total_value: 0,
  });

  // Function to generate sequential GRN number (PNK-XXX format)
  const generateGRNNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from("goods_receipt_notes")
        .select("grn_number")
        .like("grn_number", "PNK-%")
        .order("grn_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].grn_number;
        const match = lastNumber.match(/^PNK-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      return `PNK-${nextNumber.toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error generating GRN number:", error);
      return `PNK-001`;
    }
  };
  const [items, setItems] = useState<GRNItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // For existing asset mode
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemUnitCost, setNewItemUnitCost] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(10);

  // For new asset mode
  const [newAsset, setNewAsset] = useState({
    asset_id: "",
    asset_name: "",
    unit: "Cái",
    asset_type: "tools" as AssetCategory,
    warehouse_name: "",
    quantity: 1,
    unit_cost: 0,
    brand: "",
    location: "O" as AssetLocation,
    vat_rate: 10,
  });
  const [generatedCode, setGeneratedCode] = useState("");

  useEffect(() => {
    if (open) {
      if (editingGRN) {
        const dateTime = new Date(editingGRN.receipt_date);
        const utcHours = dateTime.getUTCHours().toString().padStart(2, "0");
        const utcMinutes = dateTime.getUTCMinutes().toString().padStart(2, "0");

        setFormData({
          grn_number: editingGRN.grn_number || "",
          receipt_date: editingGRN.receipt_date.split("T")[0],
          receipt_time: `${utcHours}:${utcMinutes}`,
          notes: editingGRN.notes || "",
          total_value: editingGRN.total_value || 0,
        });
        loadGRNItems(editingGRN.id);
      } else {
        // Reset for create mode
        const now = new Date();
        // Generate sequential GRN number
        generateGRNNumber().then((grnNum) => {
          setFormData({
            grn_number: grnNum,
            receipt_date: now.toISOString().split("T")[0],
            receipt_time: now.toTimeString().slice(0, 5),
            notes: "",
            total_value: 0,
          });
        });
        setItems([]);
        setNewAsset({
          asset_id: "",
          asset_name: "",
          unit: "Cái",
          asset_type: "tools",
          warehouse_name: "",
          quantity: 1,
          unit_cost: 0,
          brand: "",
          location: "O",
          vat_rate: 10,
        });
        setGeneratedCode("");
        loadAssets();
        loadWarehouses();
      }
    }
  }, [editingGRN, open]);

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("is_active", true).order("name");

      if (error) throw error;
      setWarehouses(data || []);

      // Set default warehouse if available
      if (data && data.length > 0) {
        setNewAsset((prev) => ({ ...prev, warehouse_name: data[0].name }));
      }
    } catch (error: any) {
      console.error("Error loading warehouses:", error);
    }
  };

  const loadAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("asset_master_data")
        .select("id, asset_id, asset_name, unit, warehouse_name, stock_quantity, cost_basis")
        .order("asset_name");

      if (error) throw error;
      setAssets(data || []);
    } catch (error: any) {
      console.error("Error loading assets:", error);
    }
  };

  const loadGRNItems = async (grnId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("grn_items")
        .select(
          `
          id,
          quantity,
          unit_cost,
          total_cost,
          asset_master_id,
          asset_master_data (
            asset_id,
            asset_name,
            unit,
            warehouse_name,
            opening_quantity,
            opening_value,
            inbound_quantity,
            inbound_value,
            closing_quantity,
            closing_value
          )
        `,
        )
        .eq("grn_id", grnId);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedItems: GRNItem[] = data.map((item: any) => ({
          id: item.id,
          asset_id: item.asset_master_data?.asset_id || "",
          asset_name: item.asset_master_data?.asset_name || "",
          unit: item.asset_master_data?.unit || "",
          opening_quantity: item.asset_master_data?.opening_quantity || 0,
          opening_value: item.asset_master_data?.opening_value || 0,
          inbound_quantity: item.quantity || 0,
          inbound_value: item.total_cost || 0,
          closing_quantity: item.asset_master_data?.closing_quantity || 0,
          closing_value: item.asset_master_data?.closing_value || 0,
          warehouse_name: item.asset_master_data?.warehouse_name || "KHO CHÍNH",
        }));
        setItems(loadedItems);
      } else {
        setItems([]);
      }
    } catch (error: any) {
      console.error("Error loading GRN items:", error);
      toast.error("Lỗi tải danh sách hàng: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExistingItem = () => {
    if (!selectedAsset || newItemQuantity <= 0) {
      toast.error("Vui lòng chọn hàng hóa và nhập số lượng hợp lệ");
      return;
    }

    const asset = assets.find((a) => a.id === selectedAsset);
    if (!asset) return;

    // Tính toán theo logic: (SL * Đơn giá * 1.1) + Tiền thuế VAT
    const baseValue = newItemQuantity * newItemUnitCost;
    const subTotal = baseValue * 1.1; // Hệ số 1.1 theo yêu cầu của bạn
    const vatAmount = subTotal * (vatRate / 100); // Tiền thuế tính trên subTotal
    const finalInboundValue = subTotal + vatAmount;

    const existingIndex = items.findIndex((i) => i.asset_master_id === selectedAsset);

    if (existingIndex >= 0) {
      const updatedItems = [...items];
      updatedItems[existingIndex].inbound_quantity += newItemQuantity;
      updatedItems[existingIndex].inbound_value += finalInboundValue;
      setItems(updatedItems);
    } else {
      const openingValue = asset.stock_quantity * asset.cost_basis;
      const newItem: GRNItem = {
        id: `temp-${Date.now()}`,
        asset_master_id: asset.id,
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        unit: asset.unit,
        warehouse_name: asset.warehouse_name || "KHO CHÍNH",
        opening_quantity: asset.stock_quantity,
        opening_value: openingValue,
        inbound_quantity: newItemQuantity,
        inbound_value: finalInboundValue, // Giá trị cuối cùng sau thuế và hệ số
        closing_quantity: asset.stock_quantity + newItemQuantity,
        closing_value: openingValue + finalInboundValue,
        isNew: false,
      };
      setItems([...items, newItem]);
    }

    setSelectedAsset("");
    setNewItemQuantity(1);
    setNewItemUnitCost(0);
  };

  // Auto-generate asset code based on naming convention
  const handleGenerateCode = () => {
    if (!newAsset.asset_name.trim()) {
      toast.error("Vui lòng nhập tên hàng hóa trước");
      return;
    }

    const code = generateAssetCode({
      assetName: newAsset.asset_name,
      assetType: newAsset.asset_type,
      warehouseName: newAsset.warehouse_name,
      brand: newAsset.brand,
      location: newAsset.location,
    });

    setGeneratedCode(code);
    setNewAsset((prev) => ({ ...prev, asset_id: code }));
    toast.success("Đã tạo mã hàng theo quy chuẩn");
  };

  // Update generated code when relevant fields change
  useEffect(() => {
    if (newAsset.asset_name.trim() && generatedCode) {
      const code = generateAssetCode({
        assetName: newAsset.asset_name,
        assetType: newAsset.asset_type,
        warehouseName: newAsset.warehouse_name,
        brand: newAsset.brand,
        location: newAsset.location,
      });
      setGeneratedCode(code);
      setNewAsset((prev) => ({ ...prev, asset_id: code }));
    }
  }, [newAsset.asset_type, newAsset.location, newAsset.brand]);

  const handleAddNewAsset = () => {
    // 1. Kiểm tra tính hợp lệ của dữ liệu đầu vào
    if (!newAsset.asset_name.trim()) {
      toast.error("Vui lòng nhập tên hàng hóa");
      return;
    }
    if (newAsset.quantity <= 0) {
      toast.error("Số lượng phải > 0");
      return;
    }
    if (newAsset.unit_cost < 0) {
      toast.error("Đơn giá không được âm");
      return;
    }

    // 2. Xử lý mã hàng hóa (Asset ID)
    let assetId = newAsset.asset_id.trim();
    if (!assetId) {
      assetId = generateAssetCode({
        assetName: newAsset.asset_name,
        assetType: newAsset.asset_type,
        warehouseName: newAsset.warehouse_name,
        brand: newAsset.brand,
        location: newAsset.location,
      });
    }

    // 3. Logic tính toán giá trị nhập kho (Inbound Value)
    // Công thức: (Số lượng * Đơn giá * 1.12) + VAT tương ứng
    const quantity = newAsset.quantity;
    const unitCost = newAsset.unit_cost;
    const vatRateValue = newAsset.vat_rate || 10; // Mặc định 10% nếu không chọn

    // Bước A: Tính giá trị sau khi nhân hệ số phí 1.12
    const baseAmountWithFee = quantity * unitCost * 1.12;

    // Bước B: Cộng thêm tiền thuế VAT dựa trên con số đã có phí
    // finalValue = baseAmountWithFee * (1 + vatRate / 100)
    const finalInboundValue = baseAmountWithFee * (1 + vatRateValue / 100);

    // 4. Tạo đối tượng item mới để đưa vào danh sách hiển thị
    const newItem: GRNItem = {
      id: `new-${Date.now()}`,
      asset_master_id: "", // Sẽ được xử lý khi lưu vào DB ở Backend
      asset_id: assetId,
      asset_name: newAsset.asset_name,
      unit: newAsset.unit || "Cái",
      brand: newAsset.brand,
      asset_type: newAsset.asset_type,
      warehouse_name: newAsset.warehouse_name || "KHO CHÍNH",
      opening_quantity: 0,
      opening_value: 0,
      inbound_quantity: quantity,
      inbound_value: finalInboundValue, // Giá trị cuối cùng đã bao gồm 1.12 và VAT
      closing_quantity: quantity,
      closing_value: finalInboundValue,
      isNew: true,
    };

    // 5. Cập nhật danh sách và reset form
    setItems([...items, newItem]);

    // Reset state newAsset về mặc định
    setNewAsset({
      asset_name: "",
      asset_id: "",
      asset_type: "tools",
      location: "I",
      warehouse_name: warehouses[0]?.name || "",
      brand: "",
      unit: "Cái",
      quantity: 1,
      unit_cost: 0,
      vat_rate: 10, // Reset về mức thuế mặc định
    });

    setGeneratedCode(""); // Xóa mã tạm thời đã hiển thị
    toast.success("Đã thêm tài sản mới vào danh sách");
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 hàng hóa");
      return;
    }

    setSaving(true);
    try {
      const totalValue = items.reduce((sum, item) => sum + item.inbound_value, 0);

      // Create GRN
      const receiptDateTime = `${formData.receipt_date}T${formData.receipt_time}:1Z`;

      const { data: grnData, error: grnError } = await supabase
        .from("goods_receipt_notes")
        .insert({
          grn_number: formData.grn_number,
          receipt_date: receiptDateTime,
          notes: formData.notes,
          total_value: totalValue,
          created_by: user?.id || "",
        })
        .select()
        .single();

      if (grnError) throw grnError;

      // Process items
      for (const item of items) {
        if (item.isNew) {
          // Create new asset in asset_master_data
          const { data: assetData, error: assetError } = await supabase
            .from("asset_master_data")
            .insert({
              asset_id: item.asset_id,
              asset_name: item.asset_name,
              sku: item.asset_id,
              unit: item.unit,
              warehouse_name: item.warehouse_name,
              asset_type: item.asset_type as "tools" | "equipment" | "materials",
              cost_center: item.warehouse_name,
              cost_basis: item.inbound_quantity > 0 ? item.inbound_value / item.inbound_quantity : 0,
              stock_quantity: item.closing_quantity,
              opening_quantity: 0,
              opening_value: 0,
              inbound_quantity: item.inbound_quantity,
              inbound_value: item.inbound_value,
              closing_quantity: item.closing_quantity,
              closing_value: item.closing_value,
              created_by: user?.id || "",
            })
            .select()
            .single();

          if (assetError) throw assetError;

          // Create GRN item for new asset
          const { error: itemError } = await supabase.from("grn_items").insert({
            grn_id: grnData.id,
            asset_master_id: assetData.id,
            quantity: item.inbound_quantity,
            unit_cost: item.inbound_quantity > 0 ? item.inbound_value / item.inbound_quantity : 0,
            total_cost: item.inbound_value,
          });

          if (itemError) throw itemError;
        } else if (item.asset_master_id) {
          // Existing asset - create GRN item and update stock
          const { error: itemError } = await supabase.from("grn_items").insert({
            grn_id: grnData.id,
            asset_master_id: item.asset_master_id,
            quantity: item.inbound_quantity,
            unit_cost: item.inbound_quantity > 0 ? item.inbound_value / item.inbound_quantity : 0,
            total_cost: item.inbound_value,
          });

          if (itemError) throw itemError;

          // Fetch current DB values to accumulate
          const { data: currentAsset } = await supabase
            .from("asset_master_data")
            .select("inbound_quantity, inbound_value")
            .eq("id", item.asset_master_id)
            .single();

          const existingInboundQty = currentAsset?.inbound_quantity || 0;
          const existingInboundVal = currentAsset?.inbound_value || 0;

          // Update asset stock quantity - accumulate inbound values
          const { error: updateError } = await supabase
            .from("asset_master_data")
            .update({
              stock_quantity: item.closing_quantity,
              inbound_quantity: existingInboundQty + item.inbound_quantity,
              inbound_value: existingInboundVal + item.inbound_value,
              closing_quantity: item.closing_quantity,
              closing_value: item.closing_value,
              cost_basis: item.closing_quantity > 0 ? item.closing_value / item.closing_quantity : 0,
            })
            .eq("id", item.asset_master_id);

          if (updateError) throw updateError;
        }
      }

      toast.success("Tạo phiếu nhập kho thành công!");
      onClose();
    } catch (error: any) {
      console.error("Error saving GRN:", error);
      toast.error("Lỗi tạo phiếu: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(value);
  };

  const formatCurrency = (value: number) => {
    return formatCurrencyUtil(value, { showSymbol: true });
  };

  // Filter assets for search
  const filteredAssets = assets.filter(
    (asset) =>
      asset.asset_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group items by warehouse
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.warehouse_name]) {
        acc[item.warehouse_name] = [];
      }
      acc[item.warehouse_name].push(item);
      return acc;
    },
    {} as Record<string, GRNItem[]>,
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-primary" />
            {isViewMode ? "Chi tiết Phiếu Nhập Kho" : "Tạo Phiếu Nhập Kho"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-6">
            {/* Header Info */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Thông tin phiếu
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Số phiếu
                  </Label>
                  {isViewMode ? (
                    <div className="font-semibold text-primary">{formData.grn_number}</div>
                  ) : (
                    <Input
                      value={formData.grn_number}
                      onChange={(e) => setFormData((prev) => ({ ...prev, grn_number: e.target.value }))}
                      placeholder="Số phiếu"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Ngày nhập
                  </Label>
                  {isViewMode ? (
                    <div className="font-medium">{formData.receipt_date}</div>
                  ) : (
                    <Input
                      type="date"
                      value={formData.receipt_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, receipt_date: e.target.value }))}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Giờ nhập
                  </Label>
                  {isViewMode ? (
                    <div className="font-medium">{formData.receipt_time}</div>
                  ) : (
                    <Input
                      type="time"
                      value={formData.receipt_time}
                      onChange={(e) => setFormData((prev) => ({ ...prev, receipt_time: e.target.value }))}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tổng giá trị</Label>
                  <CurrencyDisplay
                    value={items.reduce((sum, item) => sum + item.inbound_value, 0)}
                    size="lg"
                  />
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <Separator className="mb-3" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Ghi chú</Label>
                  {isViewMode ? (
                    <div className="text-sm">{formData.notes || "-"}</div>
                  ) : (
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Ghi chú..."
                      rows={2}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Add Item Section - Only in Create Mode */}
            {!isViewMode && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    Thêm hàng hóa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="existing" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing">Chọn từ kho có sẵn</TabsTrigger>
                      <TabsTrigger value="new">Tạo tài sản mới</TabsTrigger>
                    </TabsList>

                    {/* Tab: Existing Asset */}
                    <TabsContent value="existing" className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        {" "}
                        {/* Tăng lên 6 cột để đủ chỗ */}
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">Chọn hàng hóa</Label>
                          <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                            <SelectTrigger>
                              <SelectValue placeholder="Tìm và chọn hàng hóa..." />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="p-2">
                                <Input
                                  placeholder="Tìm theo mã hoặc tên..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="mb-2"
                                />
                              </div>
                              {filteredAssets.slice(0, 50).map((asset) => (
                                <SelectItem key={asset.id} value={asset.id}>
                                  <span className="font-mono text-xs">{asset.asset_id}</span>
                                  <span className="ml-2">{asset.asset_name}</span>
                                  <span className="ml-2 text-muted-foreground">({asset.unit})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Số lượng</Label>
                          <Input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={newItemQuantity === 0 ? "" : newItemQuantity}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/^0+/, "");
                              setNewItemQuantity(raw === "" ? 0 : Number(raw));
                            }}
                            onKeyDown={(e) => {
                              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Đơn giá (nhập)</Label>
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={newItemUnitCost === 0 ? "" : newItemUnitCost}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/^0+/, "");
                              setNewItemUnitCost(raw === "" ? 0 : Number(raw));
                            }}
                            onKeyDown={(e) => {
                              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                            }}
                          />
                        </div>
                        {/* Cột chọn VAT mới thêm vào */}
                        <div className="space-y-1">
                          <Label className="text-xs">Thuế VAT</Label>
                          <Select value={vatRate.toString()} onValueChange={(val) => setVatRate(Number(val))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5%</SelectItem>
                              <SelectItem value="8">8%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button onClick={handleAddExistingItem} className="w-full">
                            <Plus className="h-4 w-4 mr-1" />
                            Thêm
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                    {/* Tab: New Asset */}
                    <TabsContent value="new" className="mt-4">
                      <div className="space-y-5">
                        {/* Section 1: Thông tin cơ bản */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              1
                            </div>
                            <h4 className="text-sm font-medium">Thông tin cơ bản</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Tên hàng hóa <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={newAsset.asset_name}
                                onChange={(e) => setNewAsset((prev) => ({ ...prev, asset_name: e.target.value }))}
                                placeholder="VD: Máy khoan, Bu lông M10..."
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Thương hiệu</Label>
                              <Input
                                value={newAsset.brand}
                                onChange={(e) => setNewAsset((prev) => ({ ...prev, brand: e.target.value }))}
                                placeholder="VD: Dell, HP, Bosch..."
                                className="h-10"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Phân loại */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              2
                            </div>
                            <h4 className="text-sm font-medium">Phân loại</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Loại tài sản</Label>
                              <Select
                                value={newAsset.asset_type}
                                onValueChange={(v: AssetCategory) =>
                                  setNewAsset((prev) => ({ ...prev, asset_type: v }))
                                }
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ASSET_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Vị trí sử dụng</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  variant={newAsset.location === "I" ? "default" : "outline"}
                                  className="h-10"
                                  onClick={() => setNewAsset((prev) => ({ ...prev, location: "I" }))}
                                >
                                  <Building2 className="h-4 w-4 mr-2" />
                                  Văn phòng
                                </Button>
                                <Button
                                  type="button"
                                  variant={newAsset.location === "O" ? "default" : "outline"}
                                  className="h-10"
                                  onClick={() => setNewAsset((prev) => ({ ...prev, location: "O" }))}
                                >
                                  <HardHat className="h-4 w-4 mr-2" />
                                  Công trình
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Kho lưu trữ</Label>
                              <Select
                                value={newAsset.warehouse_name}
                                onValueChange={(v) => setNewAsset((prev) => ({ ...prev, warehouse_name: v }))}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Chọn kho..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {warehouses.map((wh) => (
                                    <SelectItem key={wh.id} value={wh.name}>
                                      {wh.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Mã hàng */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              3
                            </div>
                            <h4 className="text-sm font-medium">Mã hàng</h4>
                          </div>
                          <div className="pl-8 space-y-3">
                            <Card className="border-muted bg-muted/30">
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <p>
                                      <strong className="text-foreground">Quy chuẩn:</strong> [Loại]-[Vị
                                      trí]-[Mã]-[Thương hiệu?]-[Tuần/Năm]
                                    </p>
                                    <div className="flex flex-wrap gap-3 mt-2">
                                      <span>
                                        <Badge variant="outline" className="font-mono">
                                          CC
                                        </Badge>{" "}
                                        Công cụ
                                      </span>
                                      <span>
                                        <Badge variant="outline" className="font-mono">
                                          VT
                                        </Badge>{" "}
                                        Vật tư
                                      </span>
                                      <span>
                                        <Badge variant="outline" className="font-mono">
                                          I
                                        </Badge>{" "}
                                        Văn phòng
                                      </span>
                                      <span>
                                        <Badge variant="outline" className="font-mono">
                                          O
                                        </Badge>{" "}
                                        Công trình
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            <div className="flex gap-3 items-end">
                              <div className="flex-1 space-y-1.5">
                                <Label className="text-sm font-medium">
                                  Mã hàng{" "}
                                  <Badge variant="secondary" className="text-[10px] ml-1">
                                    Tự động tạo
                                  </Badge>
                                </Label>
                                <Input
                                  value={newAsset.asset_id}
                                  onChange={(e) =>
                                    setNewAsset((prev) => ({ ...prev, asset_id: e.target.value.toUpperCase() }))
                                  }
                                  placeholder="Nhấn nút bên phải để tạo mã tự động"
                                  className="font-mono h-10"
                                />
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      onClick={handleGenerateCode}
                                      disabled={!newAsset.asset_name.trim()}
                                      className="h-10"
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      Tạo mã
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Tạo mã hàng theo quy chuẩn</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            {generatedCode && (
                              <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/30 dark:border-green-800">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                      <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                      <p className="font-mono font-bold text-lg text-green-700 dark:text-green-400">
                                        {generatedCode}
                                      </p>
                                      <p className="text-xs text-green-600 dark:text-green-500">
                                        {getAssetCodeDescription(generatedCode)}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </div>

                        {/* Section 4: Số lượng & Giá trị */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              4
                            </div>
                            <h4 className="text-sm font-medium">Số lượng & Giá trị</h4>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pl-8">
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Đơn vị tính</Label>
                              <Input
                                value={newAsset.unit}
                                onChange={(e) => setNewAsset((prev) => ({ ...prev, unit: e.target.value }))}
                                placeholder="Cái, Bộ..."
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Số lượng <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                value={newAsset.quantity}
                                onChange={(e) => setNewAsset((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Đơn giá (VNĐ)</Label>
                              <Input
                                type="number"
                                min="0"
                                value={newAsset.unit_cost}
                                onChange={(e) =>
                                  setNewAsset((prev) => ({ ...prev, unit_cost: Number(e.target.value) }))
                                }
                                className="h-10"
                              />
                            </div>

                            {/* Ô CHỌN THUẾ VAT MỚI */}
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Thuế VAT</Label>
                              <Select
                                value={(newAsset.vat_rate || 10).toString()}
                                onValueChange={(v) => setNewAsset((prev) => ({ ...prev, vat_rate: Number(v) }))}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5">5%</SelectItem>
                                  <SelectItem value="8">8%</SelectItem>
                                  <SelectItem value="10">10%</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">Thành tiền (x1.12 + VAT)</Label>
                              <div className="h-10 flex items-center px-3 bg-green-50 dark:bg-green-950/50 rounded-md border border-green-200 dark:border-green-800">
                                <span className="font-semibold text-green-700 dark:text-green-400">
                                  {formatNumber(
                                    newAsset.quantity *
                                      newAsset.unit_cost *
                                      1.12 *
                                      (1 + (newAsset.vat_rate || 10) / 100),
                                  )}{" "}
                                  ₫
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end pt-2 border-t">
                          <Button onClick={handleAddNewAsset} size="lg">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Thêm vào danh sách
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Items List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-primary" />
                  Danh sách hàng hóa ({items.length} mặt hàng)
                </h3>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
              ) : items.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Package className="h-10 w-10 mb-3 opacity-50" />
                    <p className="text-sm">
                      {isViewMode ? "Không có hàng hóa nào" : "Chưa thêm hàng hóa nào. Vui lòng thêm hàng hóa ở trên."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedItems).map(([warehouseName, warehouseItems]) => (
                  <Card key={warehouseName}>
                    <CardHeader className="py-3 bg-muted/30">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Warehouse className="h-4 w-4 text-primary" />
                          {warehouseName}
                        </div>
                        <Badge variant="secondary">{warehouseItems.length} mặt hàng</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">TT</TableHead>
                            <TableHead>Mã hàng</TableHead>
                            <TableHead>Tên hàng</TableHead>
                            <TableHead>ĐVT</TableHead>
                            <TableHead className="text-right">Nhập SL</TableHead>
                            <TableHead className="text-right">Nhập GT</TableHead>
                            {!isViewMode && <TableHead className="w-[80px]"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {warehouseItems.map((item, index) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {item.asset_id}
                                {item.isNew && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-xs bg-green-50 text-green-700 border-green-200"
                                  >
                                    Mới
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">{item.asset_name}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatNumber(item.inbound_quantity)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatNumber(item.inbound_value)}
                              </TableCell>
                              {!isViewMode && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(items.indexOf(item))}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30 font-semibold">
                            <TableCell colSpan={4} className="text-right">
                              Tổng cộng:
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatNumber(warehouseItems.reduce((sum, item) => sum + item.inbound_quantity, 0))}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatNumber(warehouseItems.reduce((sum, item) => sum + item.inbound_value, 0))}
                            </TableCell>
                            {!isViewMode && <TableCell></TableCell>}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Tổng số mặt hàng: <span className="font-semibold text-foreground">{items.length}</span>
                    {!isViewMode && items.filter((i) => i.isNew).length > 0 && (
                      <span className="ml-2 text-green-600">({items.filter((i) => i.isNew).length} tài sản mới)</span>
                    )}
                  </div>
                  <div className="text-lg font-bold text-primary">
                    Tổng giá trị: {formatCurrency(items.reduce((sum, item) => sum + item.inbound_value, 0))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Footer - Only in Create Mode */}
        {!isViewMode && (
          <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving || items.length === 0}>
              {saving ? "Đang lưu..." : "Tạo phiếu nhập"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
