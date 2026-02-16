import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx-js-style";
import { sanitizeExcelImport } from "@/lib/excelSanitizer";

interface GRNImportDialogProps {
  open: boolean;
  onClose: () => void;
}

// Hệ số chi phí nội bộ (1.12)
const INTERNAL_FACTOR = 1.12;

interface ParsedItem {
  stt: number;
  asset_id: string;
  asset_name: string;
  unit: string;
  asset_type: string; // Loại: Công cụ, Thiết bị, Vật tư
  opening_quantity: number;
  opening_value: number;
  inbound_quantity: number;
  inbound_value: number; // Đơn giá nhập
  closing_quantity: number;
  closing_value: number; // Giá trị sau khi nhân 1.12 (Cuối kỳ GT)
  vat_rate: number; // Thuế VAT (0.05, 0.08, 0.1)
  vat_value: number; // Giá trị thuế VAT
  total_with_vat: number; // Tổng tiền đã có VAT
  warehouse_name: string;
  isValid: boolean;
  errors: string[];
  isExisting: boolean;
}

export function GRNImportDialog({ open, onClose }: GRNImportDialogProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptTime, setReceiptTime] = useState(new Date().toTimeString().slice(0, 5));
  const [grnNumber, setGrnNumber] = useState("");

  const generateGRNNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("goods_receipt_notes")
        .select("grn_number")
        .like("grn_number", "PNK-___")
        .order("grn_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].grn_number;
        const match = lastNumber.match(/^PNK-(\d{3})$/);
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

  useEffect(() => {
    if (open) {
      generateGRNNumber().then(setGrnNumber);
      setReceiptDate(new Date().toISOString().split("T")[0]);
      setReceiptTime(new Date().toTimeString().slice(0, 5));
    }
  }, [open]);

  const downloadTemplate = () => {
    // Mẫu chuẩn với VAT: STT | Kho | Mã hàng | Tên hàng | ĐVT | Loại | Đầu kỳ SL | Đầu kỳ GT | Nhập SL | Nhập GT | Cuối kỳ SL | Cuối kỳ GT | Thuế VAT | Tổng tiền đã có VAT
    const templateData = [
      [
        "STT",
        "Kho",
        "Mã hàng",
        "Tên hàng",
        "ĐVT",
        "Loại",
        "Đầu kỳ SL",
        "Đầu kỳ GT",
        "Nhập SL",
        "Nhập GT",
        "Cuối kỳ SL",
        "Cuối kỳ GT",
        "Thuế VAT",
        "Tổng tiền đã có VAT",
      ],
      [
        1,
        "KHO BẢO HỘ LAO ĐỘNG",
        "AOBH-001",
        "Áo bảo hộ",
        "Cái",
        "Công cụ",
        0,
        0,
        10,
        880000,
        10,
        9856000,
        "10%",
        10841600,
      ],
      [
        2,
        "KHO BẢO HỘ LAO ĐỘNG",
        "NON-001",
        "Nón bảo hộ",
        "Cái",
        "Công cụ",
        0,
        0,
        20,
        760000,
        20,
        17024000,
        "10%",
        18726400,
      ],
      [
        3,
        "KHO CÔNG CỤ DỤNG CỤ",
        "MAY-001",
        "Máy khoan cầm tay",
        "Cái",
        "Thiết bị",
        0,
        0,
        2,
        2500000,
        2,
        5600000,
        "10%",
        6160000,
      ],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["LƯU Ý:"],
      [
        "- Nhập đúng cấu trúc cột: STT | Kho | Mã hàng | Tên hàng | ĐVT | Loại | Đầu kỳ SL | Đầu kỳ GT | Nhập SL | Nhập GT | Cuối kỳ SL | Cuối kỳ GT | Thuế VAT | Tổng tiền đã có VAT",
      ],
      ["- Loại: Công cụ, Thiết bị, Vật tư"],
      ["- Thuế VAT: 5%, 8% hoặc 10%"],
      ["- Cuối kỳ GT = Nhập SL × Nhập GT × 1.12 (hệ số chi phí nội bộ)"],
      ["- Tổng tiền đã có VAT = Cuối kỳ GT + (Cuối kỳ GT × Thuế VAT)"],
      ["- Nếu mã hàng đã tồn tại, số lượng sẽ được cộng dồn vào kho"],
      ["- Phiếu nhập kho chỉ xem, không chỉnh sửa được sau khi nhập"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);

    const headerStyle = {
      fill: { fgColor: { rgb: "4472C4" } },
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const noteStyle = {
      fill: { fgColor: { rgb: "FFF3CD" } },
      font: { bold: false, color: { rgb: "856404" }, sz: 10 },
      alignment: { horizontal: "left", vertical: "center" },
    };

    const headerCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
    headerCols.forEach((col) => {
      const cellRef = `${col}1`;
      if (ws[cellRef]) {
        ws[cellRef].s = headerStyle;
      }
    });

    const noteRows = [7, 8, 9, 10, 11, 12, 13];
    noteRows.forEach((rowNum) => {
      const cellRef = `A${rowNum}`;
      if (ws[cellRef]) {
        ws[cellRef].s = noteStyle;
      }
    });

    ws["!cols"] = [
      { wch: 6 }, // STT
      { wch: 25 }, // Kho
      { wch: 25 }, // Mã hàng
      { wch: 40 }, // Tên hàng
      { wch: 10 }, // ĐVT
      { wch: 12 }, // Loại
      { wch: 12 }, // Đầu kỳ SL
      { wch: 14 }, // Đầu kỳ GT
      { wch: 12 }, // Nhập SL
      { wch: 14 }, // Nhập GT
      { wch: 12 }, // Cuối kỳ SL
      { wch: 14 }, // Cuối kỳ GT
      { wch: 10 }, // Thuế VAT
      { wch: 20 }, // Tổng tiền đã có VAT
    ];

    ws["!rows"] = [{ hpt: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Kho");
    XLSX.writeFile(wb, "mau_nhap_kho.xlsx");
    toast.success("Đã tải mẫu file Excel");
  };

  const parseNumber = (value: any): number => {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return value;
    const cleaned = String(value).replace(/[,\s]/g, "");
    return parseFloat(cleaned) || 0;
  };

  const parseExcelFile = async (file: File) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Lấy tất cả asset_master_data hiện có
      const { data: existingAssets } = await supabase
        .from("asset_master_data")
        .select("asset_id, warehouse_name, closing_quantity, closing_value");

      const assetMap = new Map<string, { closing_quantity: number; closing_value: number }>();
      existingAssets?.forEach((asset) => {
        const key = `${asset.asset_id}|${asset.warehouse_name}`;
        assetMap.set(key, {
          closing_quantity: asset.closing_quantity || 0,
          closing_value: asset.closing_value || 0,
        });
      });

      const items: ParsedItem[] = [];

      // Tìm vị trí cột động dựa trên header
      const findColumnIndex = (headers: any[], keywords: string[]): number => {
        for (let i = 0; i < headers.length; i++) {
          const headerValue = String(headers[i] || "")
            .trim()
            .toLowerCase();
          for (const keyword of keywords) {
            if (headerValue === keyword.toLowerCase() || headerValue.includes(keyword.toLowerCase())) {
              return i;
            }
          }
        }
        return -1;
      };

      // Tìm dòng header đầu tiên
      let headerRowIndex = -1;
      let columnMapping: {
        stt: number;
        warehouse: number;
        asset_id: number;
        asset_name: number;
        unit: number;
        asset_type: number;
        opening_qty: number;
        opening_val: number;
        inbound_qty: number;
        inbound_val: number;
        closing_qty: number;
        closing_val: number;
        vat: number;
        total_vat: number;
      } | null = null;

      for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
        const row = jsonData[i];
        if (!row) continue;

        const rowText = row.map((cell: any) => String(cell || "").toLowerCase()).join(" ");

        // Kiểm tra xem dòng này có phải là header không (chứa "Mã hàng" hoặc "Tên hàng")
        if (rowText.includes("mã hàng") || rowText.includes("tên hàng")) {
          headerRowIndex = i;

          // Map các cột theo tên header
          columnMapping = {
            stt: findColumnIndex(row, ["stt", "tt"]),
            warehouse: findColumnIndex(row, ["kho"]),
            asset_id: findColumnIndex(row, ["mã hàng", "mã"]),
            asset_name: findColumnIndex(row, ["tên hàng", "tên"]),
            unit: findColumnIndex(row, ["đvt", "đơn vị"]),
            asset_type: findColumnIndex(row, ["loại"]),
            opening_qty: findColumnIndex(row, ["đầu kỳ sl"]),
            opening_val: findColumnIndex(row, ["đầu kỳ gt"]),
            inbound_qty: findColumnIndex(row, ["nhập sl"]),
            inbound_val: findColumnIndex(row, ["nhập gt"]),
            closing_qty: findColumnIndex(row, ["cuối kỳ sl"]),
            closing_val: findColumnIndex(row, ["cuối kỳ gt"]),
            vat: findColumnIndex(row, ["thuế vat", "vat", "thuế"]),
            total_vat: findColumnIndex(row, ["tổng tiền đã có vat", "tổng vat", "tổng tiền"]),
          };

          console.log("Detected column mapping:", columnMapping);
          break;
        }
      }

      // Fallback nếu không tìm thấy header (sử dụng vị trí mặc định)
      if (!columnMapping) {
        columnMapping = {
          stt: 0,
          warehouse: 1,
          asset_id: 2,
          asset_name: 3,
          unit: 4,
          asset_type: 5,
          opening_qty: 6,
          opening_val: 7,
          inbound_qty: 8,
          inbound_val: 9,
          closing_qty: 10,
          closing_val: 11,
          vat: 12,
          total_vat: 13,
        };
      }

      const isHeaderRow = (row: any[]): boolean => {
        const headerKeywords = [
          "mã hàng",
          "tên hàng",
          "đvt",
          "stt",
          "tổng hợp",
          "từ ngày",
          "đầu kỳ",
          "số lượng",
          "giá trị",
          "phiếu nhập",
          "lưu ý",
          "không xóa",
          "nhập đúng",
          "dòng trống",
          "cuối kỳ",
          "nhập kho",
          "xuất kho",
          "công trình",
          "hợp đồng",
          "loại",
          "ngày tháng",
        ];

        for (let j = 0; j < Math.min(row.length, 6); j++) {
          const cellValue = String(row[j] || "")
            .trim()
            .toLowerCase();
          for (const keyword of headerKeywords) {
            if (cellValue === keyword || cellValue.includes(keyword)) {
              return true;
            }
          }
        }
        return false;
      };

      const isEmptyRow = (row: any[]): boolean => {
        return row.every((cell) => !String(cell || "").trim());
      };

      let sttCounter = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        if (isEmptyRow(row)) continue;
        if (isHeaderRow(row)) continue;

        // Tìm cột bắt đầu dữ liệu (bỏ qua dòng header/note)
        let stt = 0;
        let warehouse_name = "";
        let asset_id = "";
        let asset_name = "";
        let unit = "";
        let asset_type = "";
        let opening_quantity = 0;
        let opening_value = 0;
        let inbound_quantity = 0;
        let inbound_value = 0; // Đơn giá nhập (Nhập GT)
        let closing_quantity = 0;
        let closing_value = 0; // Giá trị sau 1.12 (Cuối kỳ GT)
        let vat_rate = 0.1; // Mặc định 10%
        let vat_value = 0;
        let total_with_vat = 0;

        // Kiểm tra xem ô STT có phải là số không
        const sttCellValue = columnMapping.stt >= 0 ? row[columnMapping.stt] : row[0];
        const firstCell = String(sttCellValue || "").trim();
        const isDataRow = !isNaN(Number(firstCell)) && firstCell !== "";

        if (!isDataRow) {
          // Kiểm tra dòng lưu ý
          const rowText = row.map((cell: any) => String(cell || "").toLowerCase()).join(" ");
          if (rowText.includes("lưu ý") || rowText.includes("nhập đúng") || rowText.includes("mã hàng đã tồn tại")) {
            continue;
          }
          continue;
        }

        // Parse dữ liệu theo column mapping động
        const getCell = (colIndex: number, defaultValue: any = "") => {
          return colIndex >= 0 ? row[colIndex] : defaultValue;
        };

        stt = parseNumber(getCell(columnMapping.stt, 0));
        warehouse_name = sanitizeExcelImport(getCell(columnMapping.warehouse, "")).toUpperCase() || "KHO CHÍNH";
        asset_id = sanitizeExcelImport(getCell(columnMapping.asset_id, ""));
        asset_name = sanitizeExcelImport(getCell(columnMapping.asset_name, ""));
        unit = sanitizeExcelImport(getCell(columnMapping.unit, "")) || "Cái";
        asset_type = sanitizeExcelImport(getCell(columnMapping.asset_type, "")) || "Vật tư";

        // Parse VAT rate từ chuỗi như "10%", "5%", "8%"
        const parseVatRate = (value: any): number => {
          if (value === null || value === undefined || value === "") return 0;
          const str = String(value).replace(/[%\s]/g, "").trim();
          if (str === "") return 0;
          const num = parseFloat(str);
          if (isNaN(num) || num === 0) return 0;
          return num > 1 ? num / 100 : num;
        };

        // Đọc các giá trị số theo column mapping
        opening_quantity = parseNumber(getCell(columnMapping.opening_qty, 0));
        opening_value = parseNumber(getCell(columnMapping.opening_val, 0));
        inbound_quantity = parseNumber(getCell(columnMapping.inbound_qty, 0));
        inbound_value = parseNumber(getCell(columnMapping.inbound_val, 0));

        // Parse VAT nếu có cột
        if (columnMapping.vat >= 0) {
          vat_rate = parseVatRate(getCell(columnMapping.vat, 0));
        } else {
          vat_rate = 0;
        }

        // Công thức đồng bộ: Nhập GT = Đơn giá * SL * 1.12 * (1 + VAT%)
        // Ví dụ: 30000 * 1 * 1.12 * 1.1 = 36,960
        const baseAmountWithFee = inbound_quantity * inbound_value * INTERNAL_FACTOR;
        const finalInboundValue = Math.round(baseAmountWithFee * (1 + vat_rate));

        // Cuối kỳ GT = Nhập GT (đã bao gồm 1.12 và VAT)
        closing_value = finalInboundValue;

        // Cuối kỳ SL
        const parsedClosingQty = parseNumber(getCell(columnMapping.closing_qty, 0));
        closing_quantity = parsedClosingQty || opening_quantity + inbound_quantity;

        // Tính VAT value (để hiển thị)
        vat_value = Math.round(baseAmountWithFee * vat_rate);
        total_with_vat = finalInboundValue;

        if (!asset_id || !asset_name) continue;

        const assetIdLower = asset_id.toLowerCase();
        const assetNameLower = asset_name.toLowerCase();
        if (
          assetIdLower === "mã hàng" ||
          assetIdLower === "stt" ||
          assetIdLower === "kho" ||
          assetIdLower.includes("phiếu") ||
          assetNameLower === "tên hàng" ||
          assetNameLower.includes("đầu kỳ") ||
          assetNameLower.includes("cuối kỳ") ||
          assetNameLower.includes("lưu ý")
        ) {
          continue;
        }

        const errors: string[] = [];
        if (!asset_id) errors.push("Thiếu mã hàng");
        if (!asset_name) errors.push("Thiếu tên hàng");

        // Kiểm tra xem mã đã tồn tại chưa
        const key = `${asset_id}|${warehouse_name}`;
        const existingData = assetMap.get(key);
        const isExisting = !!existingData;

        // Nếu mã đã tồn tại, đầu kỳ = cuối kỳ của lần nhập trước
        const finalOpeningQty = isExisting ? existingData?.closing_quantity || 0 : opening_quantity;
        const finalOpeningVal = isExisting ? existingData?.closing_value || 0 : opening_value;

        // Cuối kỳ SL = đầu kỳ + nhập
        const finalClosingQty = finalOpeningQty + inbound_quantity;

        sttCounter++;
        items.push({
          stt: sttCounter,
          asset_id,
          asset_name,
          unit,
          asset_type,
          opening_quantity: finalOpeningQty,
          opening_value: finalOpeningVal,
          inbound_quantity,
          inbound_value,
          closing_quantity: finalClosingQty,
          closing_value,
          vat_rate,
          vat_value,
          total_with_vat,
          warehouse_name,
          isValid: errors.length === 0,
          errors,
          isExisting,
        });
      }

      setParsedItems(items);
      toast.success(`Đã đọc ${items.length} mặt hàng từ file Excel`);
    } catch (error: any) {
      toast.error("Lỗi đọc file: " + error.message);
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

  const handleImport = async () => {
    const validItems = parsedItems.filter((item) => item.isValid);
    if (validItems.length === 0) {
      toast.error("Không có dữ liệu hợp lệ để nhập");
      return;
    }

    setImporting(true);
    try {
      const receiptDateTime = new Date(`${receiptDate}T${receiptTime}:00`);
      // Tổng giá trị phiếu nhập = tổng tất cả total_with_vat
      const totalValue = validItems.reduce((sum, item) => sum + item.total_with_vat, 0);

      const { data: grn, error: grnError } = await supabase
        .from("goods_receipt_notes")
        .insert([
          {
            grn_number: grnNumber,
            receipt_date: receiptDateTime.toISOString(),
            total_value: totalValue,
            notes: `Import từ Excel - ${file?.name}`,
            created_by: user?.id,
          },
        ])
        .select()
        .single();

      if (grnError) throw grnError;

      for (const item of validItems) {
        const { data: existingAsset } = await supabase
          .from("asset_master_data")
          .select("id, stock_quantity, inbound_quantity, inbound_value, closing_quantity, closing_value")
          .eq("asset_id", item.asset_id)
          .eq("warehouse_name", item.warehouse_name)
          .maybeSingle();

        let assetMasterId: string;
        // cost_basis = đơn giá nhập (inbound_value chính là đơn giá từ Excel)
        const unitCost = item.inbound_value;

        if (existingAsset) {
          // Mã đã tồn tại - cộng dồn số lượng và giá trị
          const newInboundQty = (existingAsset.inbound_quantity || 0) + item.inbound_quantity;
          // inbound_value tích lũy = giá trị cũ + (đơn giá * số lượng lần nhập này)
          const thisImportValue = item.inbound_value * item.inbound_quantity;
          const newInboundVal = (existingAsset.inbound_value || 0) + thisImportValue;
          const newStockQty = (existingAsset.stock_quantity || 0) + item.inbound_quantity;
          // closing_value cộng dồn giá trị có VAT
          const newClosingValue = (existingAsset.closing_value || 0) + item.total_with_vat;

          const { error: updateAssetError } = await supabase
            .from("asset_master_data")
            .update({
              stock_quantity: newStockQty,
              inbound_quantity: newInboundQty,
              inbound_value: newInboundVal,
              closing_quantity: item.closing_quantity,
              closing_value: newClosingValue, // Cộng dồn tổng có VAT
              cost_basis: unitCost, // Đơn giá nhập
              updated_at: receiptDateTime.toISOString(),
            })
            .eq("id", existingAsset.id);
          if (updateAssetError) throw updateAssetError;
          assetMasterId = existingAsset.id;
        } else {
          // Mã mới - tạo record mới
          // Map asset_type từ file sang enum
          const assetTypeMap: Record<string, "equipment" | "tools" | "materials"> = {
            "thiết bị": "equipment",
            "công cụ": "tools",
            "vật tư": "materials",
          };
          const mappedAssetType = assetTypeMap[item.asset_type.toLowerCase()] || "materials";

          // Tính toán giá trị cho record mới
          // inbound_value = đơn giá * số lượng
          const thisImportValue = item.inbound_value * item.inbound_quantity;

          const { data: newAsset, error: createAssetError } = await supabase
            .from("asset_master_data")
            .insert([
              {
                asset_id: item.asset_id,
                asset_name: item.asset_name,
                sku: item.asset_id,
                unit: item.unit,
                asset_type: mappedAssetType,
                cost_center: item.warehouse_name,
                warehouse_name: item.warehouse_name,
                cost_basis: unitCost, // Đơn giá nhập (511,000)
                stock_quantity: item.closing_quantity,
                opening_quantity: item.opening_quantity,
                opening_value: item.opening_value,
                inbound_quantity: item.inbound_quantity,
                inbound_value: thisImportValue, // Tổng giá trị nhập = đơn giá * SL
                outbound_quantity: 0,
                outbound_value: 0,
                closing_quantity: item.closing_quantity,
                closing_value: item.total_with_vat, // Tổng có VAT (4,406,864)
                current_status: "in_stock",
                created_by: user?.id,
                created_at: receiptDateTime.toISOString(),
                activation_date: receiptDate,
              },
            ])
            .select()
            .single();
          if (createAssetError) throw createAssetError;
          assetMasterId = newAsset.id;
        }

        // Lưu chi tiết phiếu nhập
        // unit_cost = đơn giá, total_cost = tổng tiền có VAT
        await supabase.from("grn_items").insert([
          {
            grn_id: grn.id,
            asset_master_id: assetMasterId,
            quantity: item.inbound_quantity,
            unit_cost: unitCost, // Đơn giá (511,000)
            total_cost: item.total_with_vat, // Tổng có VAT (4,406,864)
          },
        ]);
      }

      toast.success(`Đã nhập ${validItems.length} mặt hàng vào kho`);
      onClose();
    } catch (error: any) {
      toast.error("Lỗi nhập kho: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = async () => {
    setFile(null);
    setParsedItems([]);
    const newNumber = await generateGRNNumber();
    setGrnNumber(newNumber);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(value);
  };

  const validCount = parsedItems.filter((i) => i.isValid).length;
  const invalidCount = parsedItems.filter((i) => !i.isValid).length;
  const existingCount = parsedItems.filter((i) => i.isExisting).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập kho từ Excel</DialogTitle>
          <DialogDescription>
            Công thức: Cuối kỳ GT = (Nhập SL × Nhập GT × 1.12) + VAT. Thuế VAT được đọc từ file Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Số Phiếu Nhập</Label>
              <Input value={grnNumber} onChange={(e) => setGrnNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ngày Nhập</Label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Giờ Nhập</Label>
              <Input type="time" value={receiptTime} onChange={(e) => setReceiptTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={downloadTemplate} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Tải mẫu Excel
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>File Excel</Label>
            <div className="flex gap-2">
              <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="flex-1" />
              {file && (
                <Button variant="outline" onClick={handleReset}>
                  Xóa
                </Button>
              )}
            </div>
          </div>

          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 flex-wrap">
                <Label>Xem trước dữ liệu</Label>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Hợp lệ: {validCount}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                    <XCircle className="h-3 w-3 mr-1" />
                    Lỗi: {invalidCount}
                  </Badge>
                )}
                {existingCount > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Mã đã có: {existingCount} (sẽ cộng dồn)
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">TT</TableHead>
                      <TableHead>Kho</TableHead>
                      <TableHead>Mã hàng</TableHead>
                      <TableHead>Tên hàng</TableHead>
                      <TableHead>ĐVT</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead className="text-right">Nhập SL</TableHead>
                      <TableHead className="text-right">Nhập GT</TableHead>
                      <TableHead className="text-right">Cuối kỳ SL</TableHead>
                      <TableHead className="text-right">Cuối kỳ GT</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedItems.map((item, index) => (
                      <TableRow
                        key={index}
                        className={!item.isValid ? "bg-red-50" : item.isExisting ? "bg-blue-50" : ""}
                      >
                        <TableCell>{item.stt}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.warehouse_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.asset_id}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{item.asset_name}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-xs">{item.asset_type}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-green-600">
                          {formatNumber(item.inbound_quantity)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-green-600">
                          {formatNumber(item.inbound_value)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {formatNumber(item.closing_quantity)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-primary">
                          {formatNumber(item.total_with_vat)}
                        </TableCell>
                        <TableCell>
                          {item.isValid ? (
                            item.isExisting ? (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Cộng dồn
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mới
                              </Badge>
                            )
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              {item.errors.join(", ")}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button onClick={handleImport} disabled={importing || validCount === 0}>
              {importing ? "Đang nhập..." : `Nhập ${validCount} mặt hàng`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
