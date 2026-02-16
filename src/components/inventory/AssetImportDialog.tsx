import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Check, AlertCircle, Warehouse, Package, Wrench, Hammer } from "lucide-react";
import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeExcelImport } from "@/lib/excelSanitizer";

type AssetType = Database["public"]["Enums"]["asset_type"];

interface AssetImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedAsset {
  warehouse_name: string;
  sku: string;
  asset_name: string;
  unit: string;
  opening_quantity: number;
  opening_value: number;
  inbound_quantity: number;
  inbound_value: number;
  outbound_quantity: number;
  outbound_value: number;
  closing_quantity: number;
  closing_value: number;
  asset_type: AssetType;
  is_consumable: boolean;
  isValid: boolean;
  isWarehouseHeader: boolean;
}

interface WarehouseGroup {
  name: string;
  assets: ParsedAsset[];
  totals: {
    opening_quantity: number;
    opening_value: number;
    inbound_quantity: number;
    inbound_value: number;
    outbound_quantity: number;
    outbound_value: number;
    closing_quantity: number;
    closing_value: number;
  };
}

const parseNumber = (value: any): number => {
  if (value === null || value === undefined || value === "") return 0;
  const str = value.toString().replace(/,/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const detectAssetType = (name: string): { type: AssetType; consumable: boolean } => {
  const lowerName = name.toLowerCase();

  // Materials/consumables keywords
  const materialsKeywords = [
    "băng keo",
    "dây",
    "ốc",
    "vít",
    "đai",
    "silicon",
    "keo",
    "seal",
    "cáp",
    "dây điện",
    "ống",
    "terminal",
    "đầu cos",
    "domino",
    "bushing",
    "gen co",
    "tấm",
    "lá",
    "cuộn",
    "phim",
    "thùng",
    "can",
    "bình",
    "túi",
    "hộp",
    "cell pin",
    "cát",
    "xi măng",
    "gạch",
    "sơn",
    "móc",
    "ke",
    "thanh nhôm",
  ];

  // Equipment keywords
  const equipmentKeywords = [
    "máy",
    "thiết bị",
    "đồng hồ",
    "ampe",
    "hioki",
    "camera",
    "inverter",
    "biến tần",
    "tủ",
    "monitor",
    "ir4053",
    "fluke",
    "multimeter",
  ];

  // Tools keywords
  const toolsKeywords = [
    "kềm",
    "kìm",
    "cà lê",
    "tuốc nơ vít",
    "búa",
    "cưa",
    "khoan",
    "điếu",
    "lục giác",
    "típ",
    "vít",
    "cờ lê",
    "bộ đầu",
    "mũi khoan",
    "lưỡi cắt",
    "thước",
    "dao",
    "đèn pin",
    "kính bảo hộ",
    "áo bảo hộ",
    "nón",
    "găng tay",
  ];

  if (materialsKeywords.some((kw) => lowerName.includes(kw))) {
    return { type: "materials", consumable: true };
  }

  if (equipmentKeywords.some((kw) => lowerName.includes(kw))) {
    return { type: "equipment", consumable: false };
  }

  if (toolsKeywords.some((kw) => lowerName.includes(kw))) {
    return { type: "tools", consumable: false };
  }

  // Default to tools
  return { type: "tools", consumable: false };
};

export function AssetImportDialog({ open, onClose }: AssetImportDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedAsset[]>([]);
  const [warehouseGroups, setWarehouseGroups] = useState<WarehouseGroup[]>([]);
  const [reportPeriod, setReportPeriod] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [defaultAssetType, setDefaultAssetType] = useState<AssetType>("tools");

  const parseExcelFile = async (file: File) => {
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Extract report period from header
      let period = "";
      for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i];
        if (row) {
          const rowStr = row.join(" ");
          const match = rowStr.match(/Từ ngày\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+đến ngày\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
          if (match) {
            period = `${match[1]} - ${match[2]}`;
            break;
          }
        }
      }
      setReportPeriod(period);

      // Parse data - looking for warehouse headers and asset rows
      const assets: ParsedAsset[] = [];
      let currentWarehouse = "KHO CHÍNH";

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 3) continue;

        const firstCell = row[0]?.toString().trim() || "";
        const secondCell = row[1]?.toString().trim() || "";

        // Check if this is a warehouse header row
        if (firstCell.toLowerCase().includes("tên kho") || firstCell.toLowerCase().includes("ten kho")) {
          // Extract warehouse name - format: "Tên kho : KHO BẢO HỘ LAO ĐỘNG (3 )"
          const warehouseMatch = firstCell.match(/Tên kho\s*:\s*(.+?)(?:\s*\(\d+\s*\))?$/i);
          if (warehouseMatch) {
            currentWarehouse = warehouseMatch[1].trim();
          } else {
            currentWarehouse = firstCell
              .replace(/Tên kho\s*:\s*/i, "")
              .replace(/\s*\(\d+\s*\)\s*$/, "")
              .trim();
          }
          continue;
        }

        // Skip header rows
        if (
          firstCell === "" &&
          (secondCell.toLowerCase().includes("mã hàng") ||
            secondCell.toLowerCase().includes("số lượng") ||
            secondCell.toLowerCase() === "đvt")
        ) {
          continue;
        }

        // Check if this is an asset row (has SKU code in column 1 or 2)
        // Sanitize string values to prevent formula injection
        const sku = sanitizeExcelImport(secondCell || firstCell);
        const assetName = sanitizeExcelImport(row[2]);

        // Skip if no asset name or if it looks like a summary row
        if (!assetName || assetName.toLowerCase().includes("tổng hợp") || assetName === "") continue;

        // Skip if SKU is empty or is a header
        if (!sku || sku.toLowerCase().includes("mã hàng")) continue;

        const unit = sanitizeExcelImport(row[3]) || "Cái";

        // Parse quantities and values
        // Format: | | Mã | Tên | ĐVT | ĐK SL | ĐK GT | NK SL | NK GT | XK SL | XK GT | CK SL | CK GT |
        const opening_quantity = parseNumber(row[4]);
        const opening_value = parseNumber(row[5]);
        const inbound_quantity = parseNumber(row[6]);
        const inbound_value = parseNumber(row[7]);
        const outbound_quantity = parseNumber(row[8]);
        const outbound_value = parseNumber(row[9]);
        const closing_quantity = parseNumber(row[10]);
        const closing_value = parseNumber(row[11]);

        // Detect asset type
        const { type, consumable } = detectAssetType(assetName);

        assets.push({
          warehouse_name: currentWarehouse,
          sku,
          asset_name: assetName,
          unit,
          opening_quantity,
          opening_value,
          inbound_quantity,
          inbound_value,
          outbound_quantity,
          outbound_value,
          closing_quantity,
          closing_value,
          asset_type: type,
          is_consumable: consumable,
          isValid: assetName.length > 0 && sku.length > 0,
          isWarehouseHeader: false,
        });
      }

      // Group by warehouse
      const groups: WarehouseGroup[] = [];
      const warehouseMap = new Map<string, ParsedAsset[]>();

      assets.forEach((asset) => {
        if (!warehouseMap.has(asset.warehouse_name)) {
          warehouseMap.set(asset.warehouse_name, []);
        }
        warehouseMap.get(asset.warehouse_name)!.push(asset);
      });

      warehouseMap.forEach((warehouseAssets, warehouseName) => {
        const totals = warehouseAssets.reduce(
          (acc, asset) => ({
            opening_quantity: acc.opening_quantity + asset.opening_quantity,
            opening_value: acc.opening_value + asset.opening_value,
            inbound_quantity: acc.inbound_quantity + asset.inbound_quantity,
            inbound_value: acc.inbound_value + asset.inbound_value,
            outbound_quantity: acc.outbound_quantity + asset.outbound_quantity,
            outbound_value: acc.outbound_value + asset.outbound_value,
            closing_quantity: acc.closing_quantity + asset.closing_quantity,
            closing_value: acc.closing_value + asset.closing_value,
          }),
          {
            opening_quantity: 0,
            opening_value: 0,
            inbound_quantity: 0,
            inbound_value: 0,
            outbound_quantity: 0,
            outbound_value: 0,
            closing_quantity: 0,
            closing_value: 0,
          },
        );

        groups.push({
          name: warehouseName,
          assets: warehouseAssets,
          totals,
        });
      });

      setParsedData(assets);
      setWarehouseGroups(groups);

      if (assets.length === 0) {
        toast.warning("Không tìm thấy dữ liệu tài sản trong file");
      } else {
        toast.success(`Đã đọc ${assets.length} tài sản từ ${groups.length} kho`);
      }
    } catch (error: any) {
      toast.error("Lỗi đọc file Excel: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseExcelFile(selectedFile);
    }
  };

  const updateAssetType = (index: number, type: AssetType) => {
    setParsedData((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        asset_type: type,
        is_consumable: type === "materials",
      };
      return updated;
    });
  };

  const handleImport = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    const validAssets = parsedData.filter((a) => a.isValid);
    if (validAssets.length === 0) {
      toast.error("Không có dữ liệu hợp lệ để nhập");
      return;
    }

    setImporting(true);
    try {
      const timestamp = Date.now();
      const assetsToInsert = validAssets.map((asset, index) => ({
        asset_id: `${asset.sku}-${timestamp}-${index}`,
        sku: `${asset.sku}-${timestamp.toString(36).slice(-4)}-${index}`,
        asset_name: asset.asset_name,
        asset_type: asset.asset_type,
        cost_center: asset.warehouse_name,
        warehouse_name: asset.warehouse_name,
        unit: asset.unit,
        opening_quantity: asset.opening_quantity,
        opening_value: asset.opening_value,
        inbound_quantity: asset.inbound_quantity,
        inbound_value: asset.inbound_value,
        outbound_quantity: asset.outbound_quantity,
        outbound_value: asset.outbound_value,
        closing_quantity: asset.closing_quantity,
        closing_value: asset.closing_value,
        stock_quantity: asset.closing_quantity,
        cost_basis: asset.closing_value,
        is_consumable: asset.is_consumable,
        notes: reportPeriod ? `Kỳ báo cáo: ${reportPeriod}` : null,
        created_by: user.id,
        current_status: "in_stock" as const,
      }));

      // Insert assets
      const { data: insertedAssets, error } = await supabase
        .from("asset_master_data")
        .insert(assetsToInsert)
        .select("id, asset_name, inbound_quantity, inbound_value");

      if (error) throw error;

      // Create a GRN for the import batch
      if (insertedAssets && insertedAssets.length > 0) {
        const totalValue = insertedAssets.reduce((sum, a) => sum + (a.inbound_value || 0), 0);
        const grnNumber = `PNK-IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

        const { data: grnData, error: grnError } = await supabase
          .from("goods_receipt_notes")
          .insert({
            grn_number: grnNumber,
            receipt_date: new Date().toISOString(),
            notes: `Nhập từ Excel${reportPeriod ? ` - Kỳ: ${reportPeriod}` : ""}`,
            total_value: totalValue,
            created_by: user.id,
          })
          .select()
          .single();

        if (grnError) throw grnError;

        // Create GRN items for each asset
        const grnItems = insertedAssets
          .filter((a) => (a.inbound_quantity || 0) > 0)
          .map((a) => ({
            grn_id: grnData.id,
            asset_master_id: a.id,
            quantity: a.inbound_quantity || 0,
            unit_cost: (a.inbound_quantity || 0) > 0 ? (a.inbound_value || 0) / (a.inbound_quantity || 0) : 0,
            total_cost: a.inbound_value || 0,
          }));

        if (grnItems.length > 0) {
          const { error: grnItemsError } = await supabase.from("grn_items").insert(grnItems);
          if (grnItemsError) throw grnItemsError;
        }
      }

      toast.success(`Đã nhập thành công ${validAssets.length} tài sản vào ${warehouseGroups.length} kho`);
      handleReset();
      onClose();
    } catch (error: any) {
      toast.error("Lỗi nhập dữ liệu: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setWarehouseGroups([]);
    setReportPeriod("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString("vi-VN");
  };

  const getAssetTypeIcon = (type: AssetType) => {
    switch (type) {
      case "equipment":
        return <Package className="h-3 w-3" />;
      case "tools":
        return <Wrench className="h-3 w-3" />;
      case "materials":
        return <Hammer className="h-3 w-3" />;
    }
  };

  const getAssetTypeLabel = (type: AssetType) => {
    switch (type) {
      case "equipment":
        return "Thiết bị";
      case "tools":
        return "Dụng cụ";
      case "materials":
        return "Vật tư";
    }
  };

  const validCount = parsedData.filter((a) => a.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Nhập dữ liệu Tồn kho từ Excel
          </DialogTitle>
          <DialogDescription>Tải lên file Excel báo cáo tồn kho để nhập dữ liệu tài sản vào hệ thống</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
            />
            <Label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file ? file.name : "Chọn file Excel báo cáo tồn kho (.xlsx, .xls)"}
              </span>
              <span className="text-xs text-muted-foreground">
                Format: TỔNG HỢP TỒN KHO với các cột Mã hàng, Tên hàng, ĐVT, Đầu kỳ, Nhập kho, Xuất kho, Cuối kỳ
              </span>
            </Label>
          </div>

          {/* Report Period & Summary */}
          {warehouseGroups.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {reportPeriod && (
                    <Badge variant="secondary" className="text-sm">
                      Kỳ báo cáo: {reportPeriod}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {warehouseGroups.length} kho • {validCount} tài sản
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Loại mặc định:</Label>
                  <Select value={defaultAssetType} onValueChange={(v) => setDefaultAssetType(v as AssetType)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipment">Thiết bị</SelectItem>
                      <SelectItem value="tools">Dụng cụ</SelectItem>
                      <SelectItem value="materials">Vật tư</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Warehouse Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {warehouseGroups.map((group, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-background rounded px-3 py-2">
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.assets.length} mặt hàng</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {warehouseGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Xem trước dữ liệu ({validCount} tài sản hợp lệ)</h4>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Xóa và chọn file khác
                </Button>
              </div>

              <div className="border rounded-lg max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-32">Kho</TableHead>
                      <TableHead className="w-24">Mã hàng</TableHead>
                      <TableHead>Tên hàng</TableHead>
                      <TableHead className="w-16">ĐVT</TableHead>
                      <TableHead className="w-24 text-right">ĐK SL</TableHead>
                      <TableHead className="w-28 text-right">ĐK GT</TableHead>
                      <TableHead className="w-24 text-right">NK SL</TableHead>
                      <TableHead className="w-28 text-right">NK GT</TableHead>
                      <TableHead className="w-24 text-right">CK SL</TableHead>
                      <TableHead className="w-28 text-right">CK GT</TableHead>
                      <TableHead className="w-24">Loại</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((asset, index) => (
                      <TableRow key={index} className={!asset.isValid ? "opacity-50" : ""}>
                        <TableCell className="text-xs">{asset.warehouse_name}</TableCell>
                        <TableCell className="font-mono text-xs">{asset.sku}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate" title={asset.asset_name}>
                          {asset.asset_name}
                        </TableCell>
                        <TableCell className="text-xs">{asset.unit}</TableCell>
                        <TableCell className="text-right text-xs">{formatNumber(asset.opening_quantity)}</TableCell>
                        <TableCell className="text-right text-xs">{formatNumber(asset.opening_value)}</TableCell>
                        <TableCell className="text-right text-xs">{formatNumber(asset.inbound_quantity)}</TableCell>
                        <TableCell className="text-right text-xs">{formatNumber(asset.inbound_value)}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {formatNumber(asset.closing_quantity)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {formatNumber(asset.closing_value)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={asset.asset_type}
                            onValueChange={(v) => updateAssetType(index, v as AssetType)}
                          >
                            <SelectTrigger className="h-7 w-20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equipment">
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" /> TB
                                </span>
                              </SelectItem>
                              <SelectItem value="tools">
                                <span className="flex items-center gap-1">
                                  <Wrench className="h-3 w-3" /> DC
                                </span>
                              </SelectItem>
                              <SelectItem value="materials">
                                <span className="flex items-center gap-1">
                                  <Hammer className="h-3 w-3" /> VT
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {asset.isValid ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button onClick={handleImport} disabled={loading || importing || validCount === 0}>
              {importing ? "Đang nhập..." : `Nhập ${validCount} tài sản`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
