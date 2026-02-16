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
  User,
  Target,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GINDialogProps {
  open: boolean;
  onClose: () => void;
  editingGIN?: any;
}

interface GINItem {
  id: string;
  asset_master_id: string;
  asset_id: string;
  asset_name: string;
  unit: string;
  stock_quantity: number;
  issue_quantity: number;
  unit_cost: number;
  total_cost: number;
  warehouse_name: string;
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

interface Project {
  id: string;
  name: string;
}

export function GINDialog({ open, onClose, editingGIN }: GINDialogProps) {
  const { user } = useAuth();
  const isViewMode = !!editingGIN;

  const [formData, setFormData] = useState({
    gin_number: "",
    issue_date: new Date().toISOString().split("T")[0],
    issue_time: new Date().toTimeString().slice(0, 5),
    recipient: "",
    purpose: "",
    project_id: "",
    notes: "",
  });

  const [items, setItems] = useState<GINItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [issueQuantity, setIssueQuantity] = useState<number>(1);

  // Generate sequential GIN number (PXK-XXX format)
  const generateGINNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from("goods_issue_notes")
        .select("gin_number")
        .like("gin_number", "PXK-%")
        .order("gin_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].gin_number;
        const match = lastNumber.match(/^PXK-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      return `PXK-${nextNumber.toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error generating GIN number:", error);
      return `PXK-001`;
    }
  };

  useEffect(() => {
    if (open) {
      if (editingGIN) {
        const dateTime = new Date(editingGIN.issue_date);
        const utcHours = dateTime.getUTCHours().toString().padStart(2, "0");
        const utcMinutes = dateTime.getUTCMinutes().toString().padStart(2, "0");

        setFormData({
          gin_number: editingGIN.gin_number || "",
          issue_date: editingGIN.issue_date.split("T")[0],
          issue_time: `${utcHours}:${utcMinutes}`,
          recipient: editingGIN.recipient || "",
          purpose: editingGIN.purpose || "",
          project_id: editingGIN.project_id || "",
          notes: editingGIN.notes || "",
        });
        loadGINItems(editingGIN.id);
      } else {
        const now = new Date();
        generateGINNumber().then((ginNum) => {
          setFormData({
            gin_number: ginNum,
            issue_date: now.toISOString().split("T")[0],
            issue_time: now.toTimeString().slice(0, 5),
            recipient: "",
            purpose: "",
            project_id: "",
            notes: "",
          });
        });
        setItems([]);
        loadAssets();
        loadProjects();
      }
    }
  }, [editingGIN, open]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error("Error loading projects:", error);
    }
  };

  const loadAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("asset_master_data")
        .select("id, asset_id, asset_name, unit, warehouse_name, stock_quantity, cost_basis")
        .gt("stock_quantity", 0)
        .order("asset_name");

      if (error) throw error;
      setAssets(data || []);
    } catch (error: any) {
      console.error("Error loading assets:", error);
    }
  };

  const loadGINItems = async (ginId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gin_items")
        .select(`
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
            stock_quantity
          )
        `)
        .eq("gin_id", ginId);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedItems: GINItem[] = data.map((item: any) => ({
          id: item.id,
          asset_master_id: item.asset_master_id,
          asset_id: item.asset_master_data?.asset_id || "",
          asset_name: item.asset_master_data?.asset_name || "",
          unit: item.asset_master_data?.unit || "",
          warehouse_name: item.asset_master_data?.warehouse_name || "KHO CHÍNH",
          stock_quantity: item.asset_master_data?.stock_quantity || 0,
          issue_quantity: item.quantity || 0,
          unit_cost: item.unit_cost || 0,
          total_cost: item.total_cost || 0,
        }));
        setItems(loadedItems);
      } else {
        setItems([]);
      }
    } catch (error: any) {
      console.error("Error loading GIN items:", error);
      toast.error("Lỗi tải danh sách hàng: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedAsset || issueQuantity <= 0) {
      toast.error("Vui lòng chọn hàng hóa và nhập số lượng hợp lệ");
      return;
    }

    const asset = assets.find((a) => a.id === selectedAsset);
    if (!asset) return;

    if (issueQuantity > asset.stock_quantity) {
      toast.error(`Số lượng xuất (${issueQuantity}) vượt quá tồn kho (${asset.stock_quantity})`);
      return;
    }

    const existingIndex = items.findIndex((i) => i.asset_master_id === selectedAsset);

    if (existingIndex >= 0) {
      const newTotal = items[existingIndex].issue_quantity + issueQuantity;
      if (newTotal > asset.stock_quantity) {
        toast.error(`Tổng số lượng xuất (${newTotal}) vượt quá tồn kho (${asset.stock_quantity})`);
        return;
      }
      
      const updatedItems = [...items];
      updatedItems[existingIndex].issue_quantity = newTotal;
      updatedItems[existingIndex].total_cost = newTotal * asset.cost_basis;
      setItems(updatedItems);
    } else {
      const newItem: GINItem = {
        id: `temp-${Date.now()}`,
        asset_master_id: asset.id,
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        unit: asset.unit,
        warehouse_name: asset.warehouse_name || "KHO CHÍNH",
        stock_quantity: asset.stock_quantity,
        issue_quantity: issueQuantity,
        unit_cost: asset.cost_basis,
        total_cost: issueQuantity * asset.cost_basis,
      };
      setItems([...items, newItem]);
    }

    setSelectedAsset("");
    setIssueQuantity(1);
    toast.success("Đã thêm hàng hóa vào danh sách");
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
      const totalValue = items.reduce((sum, item) => sum + item.total_cost, 0);
      const issueDateTime = `${formData.issue_date}T${formData.issue_time}:00Z`;

      // Create GIN
      const { data: ginData, error: ginError } = await supabase
        .from("goods_issue_notes")
        .insert({
          gin_number: formData.gin_number,
          issue_date: issueDateTime,
          recipient: formData.recipient || null,
          purpose: formData.purpose || null,
          project_id: formData.project_id || null,
          notes: formData.notes || null,
          total_value: totalValue,
          created_by: user?.id || "",
        })
        .select()
        .single();

      if (ginError) throw ginError;

      // Process items and update stock
      for (const item of items) {
        const { error: itemError } = await supabase.from("gin_items").insert({
          gin_id: ginData.id,
          asset_master_id: item.asset_master_id,
          quantity: item.issue_quantity,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
        });

        if (itemError) throw itemError;

        const { data: currentAsset, error: fetchError } = await supabase
          .from("asset_master_data")
          .select("stock_quantity, outbound_quantity, outbound_value, inbound_quantity, closing_quantity, closing_value, cost_basis")
          .eq("id", item.asset_master_id)
          .single();

        if (fetchError) throw fetchError;

        const newStockQty = (currentAsset.stock_quantity || 0) - item.issue_quantity;
        const newOutboundQty = (currentAsset.outbound_quantity || 0) + item.issue_quantity;
        const unitCost = currentAsset.cost_basis || 0;
        const newOutboundValue = (currentAsset.outbound_value || 0) + (item.issue_quantity * unitCost);
        const newClosingQty = (currentAsset.inbound_quantity || 0) - newOutboundQty;
        const newClosingValue = newClosingQty * unitCost;

        const { error: updateError } = await supabase
          .from("asset_master_data")
          .update({
            stock_quantity: newStockQty,
            outbound_quantity: newOutboundQty,
            outbound_value: newOutboundValue,
            closing_quantity: newClosingQty,
            closing_value: newClosingValue,
            current_status: newStockQty === 0 ? "allocated" : "in_stock",
          })
          .eq("id", item.asset_master_id);

        if (updateError) throw updateError;
      }

      toast.success(`Đã tạo phiếu xuất kho ${formData.gin_number}`);
      onClose();
    } catch (error: any) {
      console.error("Error saving GIN:", error);
      toast.error("Lỗi lưu phiếu: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
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
    {} as Record<string, GINItem[]>,
  );

  const totalValue = items.reduce((sum, item) => sum + item.total_cost, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.issue_quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-orange-600" />
            {isViewMode ? "Chi tiết Phiếu Xuất Kho" : "Tạo Phiếu Xuất Kho"}
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
                    <div className="font-semibold text-orange-600">{formData.gin_number}</div>
                  ) : (
                    <Input
                      value={formData.gin_number}
                      onChange={(e) => setFormData((prev) => ({ ...prev, gin_number: e.target.value }))}
                      placeholder="Số phiếu"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Ngày xuất
                  </Label>
                  {isViewMode ? (
                    <div className="font-medium">{formData.issue_date}</div>
                  ) : (
                    <Input
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, issue_date: e.target.value }))}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Giờ xuất
                  </Label>
                  {isViewMode ? (
                    <div className="font-medium">{formData.issue_time}</div>
                  ) : (
                    <Input
                      type="time"
                      value={formData.issue_time}
                      onChange={(e) => setFormData((prev) => ({ ...prev, issue_time: e.target.value }))}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tổng giá trị</Label>
                  <div className="font-semibold text-orange-600">
                    {formatCurrency(totalValue)}
                  </div>
                </div>
              </CardContent>
              <CardContent className="pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Người nhận
                  </Label>
                  {isViewMode ? (
                    <div className="font-medium">{formData.recipient || "-"}</div>
                  ) : (
                    <Input
                      value={formData.recipient}
                      onChange={(e) => setFormData((prev) => ({ ...prev, recipient: e.target.value }))}
                      placeholder="Tên người nhận"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Mục đích xuất
                  </Label>
                  {isViewMode ? (
                    <div className="font-medium">{formData.purpose || "-"}</div>
                  ) : (
                    <Input
                      value={formData.purpose}
                      onChange={(e) => setFormData((prev) => ({ ...prev, purpose: e.target.value }))}
                      placeholder="VD: Xuất cho công trình A..."
                    />
                  )}
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Warehouse className="h-3 w-3" />
                      Dự án liên quan
                    </Label>
                    {isViewMode ? (
                      <div className="font-medium">
                        {projects.find(p => p.id === formData.project_id)?.name || "-"}
                      </div>
                    ) : (
                      <Select
                        value={formData.project_id || "none"}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, project_id: value === "none" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn dự án (nếu có)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Không liên kết dự án</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <Separator className="my-3" />
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
                    <Plus className="h-4 w-4 text-orange-600" />
                    Thêm hàng hóa xuất kho
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                          <ScrollArea className="h-[300px]">
                            {filteredAssets.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                Không tìm thấy hàng hóa
                              </div>
                            ) : (
                              filteredAssets.map((asset) => (
                                <SelectItem key={asset.id} value={asset.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">{asset.asset_id}</span>
                                    <span className="truncate max-w-[200px]">{asset.asset_name}</span>
                                    <Badge variant="outline" className="ml-auto text-xs">
                                      {asset.stock_quantity} {asset.unit}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Số lượng xuất</Label>
                      <Input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={issueQuantity === 0 ? "" : issueQuantity}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/^0+/, "");
                          setIssueQuantity(raw === "" ? 0 : Number(raw));
                        }}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Đơn giá</Label>
                      <div className="h-10 flex items-center px-3 bg-muted rounded-md border text-sm">
                        {selectedAsset
                          ? formatNumber(assets.find((a) => a.id === selectedAsset)?.cost_basis || 0) + " ₫"
                          : "—"}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddItem} className="w-full bg-orange-600 hover:bg-orange-700">
                        <Plus className="h-4 w-4 mr-1" />
                        Thêm
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-orange-600" />
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
                <div className="space-y-4">
                  {Object.entries(groupedItems).map(([warehouseName, warehouseItems]) => (
                    <Card key={warehouseName}>
                      <CardHeader className="py-3 bg-muted/30">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-orange-600" />
                            {warehouseName}
                          </div>
                          <Badge variant="secondary">{warehouseItems.length} mặt hàng</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="max-h-[250px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">TT</TableHead>
                                <TableHead>Mã hàng</TableHead>
                                <TableHead>Tên hàng</TableHead>
                                <TableHead>ĐVT</TableHead>
                                <TableHead className="text-right">Xuất SL</TableHead>
                                <TableHead className="text-right">Xuất GT</TableHead>
                                {!isViewMode && <TableHead className="w-[80px]"></TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {warehouseItems.map((item, index) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{index + 1}</TableCell>
                                  <TableCell className="font-mono text-xs">{item.asset_id}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{item.asset_name}</TableCell>
                                  <TableCell>{item.unit}</TableCell>
                                  <TableCell className="text-right font-semibold text-orange-600">
                                    {formatNumber(item.issue_quantity)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-orange-600">
                                    {formatNumber(item.total_cost)}
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
                                <TableCell className="text-right text-orange-600">
                                  {formatNumber(warehouseItems.reduce((sum, item) => sum + item.issue_quantity, 0))}
                                </TableCell>
                                <TableCell className="text-right text-orange-600">
                                  {formatNumber(warehouseItems.reduce((sum, item) => sum + item.total_cost, 0))}
                                </TableCell>
                                {!isViewMode && <TableCell></TableCell>}
                              </TableRow>
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <Card className="bg-orange-500/5 border-orange-500/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Tổng số mặt hàng: <span className="font-semibold text-foreground">{items.length}</span>
                    <span className="mx-3">|</span>
                    Tổng số lượng: <span className="font-semibold text-foreground">{totalQuantity}</span>
                  </div>
                  <div className="text-lg font-bold text-orange-600">
                    Tổng giá trị: {formatCurrency(totalValue)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {isViewMode ? "Đóng" : "Hủy"}
          </Button>
          {!isViewMode && (
            <Button onClick={handleSave} disabled={saving || items.length === 0} className="bg-orange-600 hover:bg-orange-700">
              {saving ? "Đang lưu..." : "Tạo phiếu xuất"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
