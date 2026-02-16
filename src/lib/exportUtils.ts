import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadRobotoFont, arrayBufferToBase64 } from "./pdfFonts";
import logoKBA from "@/assets/logo_KBA.webp";
import { sanitizeExcelCell } from "./excelSanitizer";

// Helper function to load image as base64
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };
    img.onerror = reject;
    img.src = src;
  });
};
interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  title: string;
  filename: string;
  columns: ExportColumn[];
  data: any[];
  summary?: { label: string; value: string }[];
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
};

const formatDate = (date: string | null): string => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("vi-VN");
};

const formatValue = (value: any, key: string): string => {
  if (value === null || value === undefined) return "";
  
  // Format currency fields
  if (key.includes("price") || key.includes("cost") || key.includes("value") || 
      key.includes("amount") || key.includes("budget") || key.includes("salary")) {
    return formatCurrency(Number(value));
  }
  
  // Format date fields
  if (key.includes("date") || key.includes("_at")) {
    return formatDate(value);
  }
  
  // Format status
  if (key === "status") {
    const statusMap: Record<string, string> = {
      planning: "Lên kế hoạch",
      in_progress: "Đang thực hiện",
      completed: "Hoàn thành",
      on_hold: "Tạm dừng",
      pending: "Chờ xử lý",
      overdue: "Quá hạn",
      active: "Hoạt động",
      inactive: "Không hoạt động",
      in_stock: "Trong kho",
      allocated: "Đã cấp phát",
      under_maintenance: "Bảo trì",
      disposed: "Đã thanh lý",
    };
    return statusMap[value] || value;
  }
  
  return String(value);
};

export const exportToExcel = ({ title, filename, columns, data, summary }: ExportOptions): void => {
  // Prepare data rows with formula injection sanitization
  const rows = data.map((item) =>
    columns.reduce((acc, col) => {
      const rawValue = formatValue(item[col.key], col.key);
      // Sanitize to prevent Excel formula injection
      acc[col.header] = sanitizeExcelCell(rawValue);
      return acc;
    }, {} as Record<string, any>)
  );

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const colWidths = columns.map((col) => ({
    wch: col.width || Math.max(col.header.length, 15),
  }));
  ws["!cols"] = colWidths;

  // Add summary if provided
  if (summary && summary.length > 0) {
    const lastRow = rows.length + 2;
    summary.forEach((item, index) => {
      XLSX.utils.sheet_add_aoa(ws, [[item.label, item.value]], {
        origin: `A${lastRow + index}`,
      });
    });
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31));

  // Download
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
};

export const exportToPDF = async ({ title, filename, columns, data, summary }: ExportOptions): Promise<void> => {
  const doc = new jsPDF({
    orientation: columns.length > 5 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // Load and add Roboto font with Vietnamese support
  try {
    const fonts = await loadRobotoFont();
    const normalBase64 = arrayBufferToBase64(fonts.normal);
    const boldBase64 = arrayBufferToBase64(fonts.bold);
    
    doc.addFileToVFS("Roboto-Regular.ttf", normalBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    
    doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    
    doc.setFont("Roboto");
  } catch (error) {
    console.warn("Could not load Roboto font, using default font:", error);
    doc.setFont("helvetica");
  }

  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.text(`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`, 14, 28);

  // Prepare table data
  const headers = columns.map((col) => col.header);
  const tableData = data.map((item) =>
    columns.map((col) => formatValue(item[col.key], col.key))
  );

  // Add table
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 35,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: "Roboto",
    },
    headStyles: {
      fillColor: [26, 183, 167],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: columns.reduce((acc, col, index) => {
      if (col.key.includes("price") || col.key.includes("cost") || 
          col.key.includes("value") || col.key.includes("amount")) {
        acc[index] = { halign: "right" };
      }
      return acc;
    }, {} as Record<number, any>),
  });

  // Add summary if provided
  if (summary && summary.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    summary.forEach((item, index) => {
      doc.text(`${item.label}: ${item.value}`, 14, finalY + index * 6);
    });
  }

  // Download
  doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
};

// Predefined export configurations for each module
export const projectExportConfig = {
  columns: [
    { header: "Tên dự án", key: "name", width: 30 },
    { header: "Trạng thái", key: "status", width: 15 },
    { header: "Ưu tiên", key: "priority", width: 10 },
    { header: "Ngân sách", key: "budget", width: 20 },
    { header: "Địa điểm", key: "location", width: 25 },
    { header: "Ngày bắt đầu", key: "start_date", width: 15 },
    { header: "Ngày kết thúc", key: "end_date", width: 15 },
  ],
};

export const employeeExportConfig = {
  columns: [
    { header: "Họ tên", key: "full_name", width: 25 },
    { header: "Phòng ban", key: "department", width: 20 },
    { header: "Chức vụ", key: "position", width: 20 },
    { header: "Số điện thoại", key: "phone", width: 15 },
    { header: "Ngày vào làm", key: "date_joined", width: 15 },
    { header: "Ngày sinh", key: "date_of_birth", width: 15 },
    { header: "Chứng chỉ hết hạn", key: "certificate_expiry_date", width: 18 },
  ],
};

export const transactionExportConfig = {
  columns: [
    { header: "Ngày giao dịch", key: "transaction_date", width: 15 },
    { header: "Loại", key: "transaction_type", width: 10 },
    { header: "Danh mục", key: "category", width: 20 },
    { header: "Mô tả", key: "description", width: 30 },
    { header: "Số tiền", key: "amount", width: 20 },
  ],
};

export const inventoryExportConfig = {
  columns: [
    { header: "Mã SP", key: "product_code", width: 15 },
    { header: "Tên sản phẩm", key: "product_name", width: 30 },
    { header: "Đơn vị", key: "unit", width: 10 },
    { header: "Tồn kho", key: "stock_quantity", width: 12 },
    { header: "Tồn tối thiểu", key: "min_stock_level", width: 12 },
    { header: "Giá bán lẻ", key: "retail_price", width: 18 },
    { header: "Giá sỉ", key: "wholesale_price", width: 18 },
  ],
};

export const contractExportConfig = {
  columns: [
    { header: "Số hợp đồng", key: "contract_number", width: 18 },
    { header: "Khách hàng", key: "client_name", width: 25 },
    { header: "Loại HĐ", key: "contract_type", width: 15 },
    { header: "Giá trị HĐ", key: "contract_value", width: 20 },
    { header: "Đã thanh toán", key: "payment_value", width: 20 },
    { header: "Ngày hiệu lực", key: "effective_date", width: 15 },
    { header: "Ngày hết hạn", key: "expiry_date", width: 15 },
    { header: "Trạng thái", key: "status", width: 12 },
  ],
};

export const assetExportConfig = {
  columns: [
    { header: "Mã tài sản", key: "asset_id", width: 15 },
    { header: "Tên tài sản", key: "asset_name", width: 30 },
    { header: "Loại", key: "asset_type", width: 12 },
    { header: "Nguyên giá", key: "cost_basis", width: 18 },
    { header: "Giá trị còn lại", key: "nbv", width: 18 },
    { header: "Trạng thái", key: "current_status", width: 15 },
    { header: "Trung tâm CP", key: "cost_center", width: 15 },
  ],
};

export const taskExportConfig = {
  columns: [
    { header: "Tiêu đề", key: "title", width: 30 },
    { header: "Dự án", key: "project_name", width: 25 },
    { header: "Người thực hiện", key: "assignee_name", width: 20 },
    { header: "Trạng thái", key: "status", width: 15 },
    { header: "Ưu tiên", key: "priority", width: 12 },
    { header: "Ngày đến hạn", key: "due_date", width: 15 },
    { header: "Mô tả", key: "description", width: 35 },
  ],
};

// =====================================================
// ENHANCED TASK EXPORT WITH GROUPING, STATS & PIE CHART
// =====================================================

interface TaskData {
  title: string;
  project_name?: string;
  assignee_name?: string;
  status: string;
  priority?: string;
  due_date?: string | null;
  created_at?: string | null;
  description?: string | null;
  completion_percentage?: number;
}

interface TaskExportOptions {
  tasks: TaskData[];
  sortBy?: 'status' | 'name';
}

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: "Chờ xử lý",
    in_progress: "Đang thực hiện",
    completed: "Hoàn thành",
    overdue: "Quá hạn",
  };
  return statusMap[status] || status;
};

const isCompletedStatus = (status: string): boolean => {
  return status === "completed";
};

export const exportTasksToExcel = ({ tasks, sortBy = 'status' }: TaskExportOptions): void => {
  // Sort tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'status') {
      const aCompleted = isCompletedStatus(a.status) ? 1 : 0;
      const bCompleted = isCompletedStatus(b.status) ? 1 : 0;
      return aCompleted - bCompleted;
    }
    return a.title.localeCompare(b.title, 'vi');
  });

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => isCompletedStatus(t.status)).length;
  const incompleteTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0';
  
  // Calculate average completion percentage
  const totalCompletionPercentage = tasks.reduce((sum, t) => sum + (t.completion_percentage || 0), 0);
  const avgCompletionPercentage = totalTasks > 0 ? (totalCompletionPercentage / totalTasks).toFixed(1) : '0';

  // Group tasks
  const completed = sortedTasks.filter(t => isCompletedStatus(t.status));
  const incomplete = sortedTasks.filter(t => !isCompletedStatus(t.status));

  // Create workbook
  const wb = XLSX.utils.book_new();

  // ========== SHEET 1: SUMMARY WITH PIE CHART ==========
  const summaryData: any[][] = [];
  
  // Title
  summaryData.push(["BÁO CÁO TỔNG HỢP NHIỆM VỤ"]);
  summaryData.push([`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`]);
  summaryData.push([]);
  
  // Statistics section
  summaryData.push(["THỐNG KÊ TỔNG QUAN"]);
  summaryData.push(["Tổng số nhiệm vụ:", totalTasks]);
  summaryData.push(["Đã hoàn thành:", completedTasks]);
  summaryData.push(["Chưa hoàn thành:", incompleteTasks]);
  summaryData.push(["Tỷ lệ hoàn thành (theo trạng thái):", `${completionRate}%`]);
  summaryData.push(["Tiến độ trung bình:", `${avgCompletionPercentage}%`]);
  summaryData.push([]);
  
  // Pie chart data section
  summaryData.push(["DỮ LIỆU BIỂU ĐỒ"]);
  summaryData.push(["Trạng thái", "Số lượng", "Tỷ lệ (%)"]);
  summaryData.push(["Hoàn thành", completedTasks, totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0]);
  summaryData.push(["Chưa hoàn thành", incompleteTasks, totalTasks > 0 ? ((incompleteTasks / totalTasks) * 100).toFixed(1) : 0]);
  summaryData.push([]);
  
  // Visual progress bar representation
  summaryData.push(["TIẾN ĐỘ TRỰC QUAN"]);
  const progressBar = totalTasks > 0 
    ? "█".repeat(Math.round(Number(avgCompletionPercentage) / 5)) + "░".repeat(20 - Math.round(Number(avgCompletionPercentage) / 5))
    : "░".repeat(20);
  summaryData.push([`[${progressBar}] ${avgCompletionPercentage}%`]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
  wsSummary["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // ========== SHEET 2: COMPLETED TASKS ==========
  const completedData: any[][] = [];
  completedData.push(["NHIỆM VỤ ĐÃ HOÀN THÀNH"]);
  completedData.push([`Tổng: ${completed.length} nhiệm vụ`]);
  completedData.push([]);
  completedData.push(["STT", "Tiêu đề", "Dự án", "Người thực hiện", "Tiến độ (%)", "Ưu tiên", "Ngày tạo", "Ngày đến hạn", "Mô tả"]);
  
  completed.forEach((task, index) => {
    completedData.push([
      index + 1,
      task.title,
      task.project_name || "",
      task.assignee_name || "Chưa phân công",
      task.completion_percentage || 0,
      task.priority || "",
      task.created_at ? new Date(task.created_at).toLocaleDateString("vi-VN") : "",
      task.due_date ? new Date(task.due_date).toLocaleDateString("vi-VN") : "",
      task.description || ""
    ]);
  });

  if (completed.length === 0) {
    completedData.push(["", "Không có nhiệm vụ nào đã hoàn thành", "", "", "", "", "", "", ""]);
  }

  const wsCompleted = XLSX.utils.aoa_to_sheet(completedData);
  wsCompleted["!cols"] = [
    { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 35 }
  ];
  wsCompleted["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsCompleted, "Đã hoàn thành");

  // ========== SHEET 3: INCOMPLETE TASKS ==========
  const incompleteData: any[][] = [];
  incompleteData.push(["NHIỆM VỤ CHƯA HOÀN THÀNH"]);
  incompleteData.push([`Tổng: ${incomplete.length} nhiệm vụ`]);
  incompleteData.push([]);
  incompleteData.push(["STT", "Tiêu đề", "Dự án", "Người thực hiện", "Tiến độ (%)", "Trạng thái", "Ưu tiên", "Ngày tạo", "Ngày đến hạn", "Mô tả"]);
  
  incomplete.forEach((task, index) => {
    incompleteData.push([
      index + 1,
      task.title,
      task.project_name || "",
      task.assignee_name || "Chưa phân công",
      task.completion_percentage || 0,
      getStatusLabel(task.status),
      task.priority || "",
      task.created_at ? new Date(task.created_at).toLocaleDateString("vi-VN") : "",
      task.due_date ? new Date(task.due_date).toLocaleDateString("vi-VN") : "",
      task.description || ""
    ]);
  });

  if (incomplete.length === 0) {
    incompleteData.push(["", "Tất cả nhiệm vụ đã hoàn thành!", "", "", "", "", "", "", "", ""]);
  }

  const wsIncomplete = XLSX.utils.aoa_to_sheet(incompleteData);
  wsIncomplete["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }
  ];
  wsIncomplete["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsIncomplete, "Chưa hoàn thành");

  // Download
  XLSX.writeFile(wb, `bao_cao_nhiem_vu_${new Date().toISOString().split("T")[0]}.xlsx`);
};

export const exportTasksToPDF = async ({ tasks, sortBy = 'status' }: TaskExportOptions): Promise<void> => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Load font
  try {
    const fonts = await loadRobotoFont();
    const normalBase64 = arrayBufferToBase64(fonts.normal);
    const boldBase64 = arrayBufferToBase64(fonts.bold);
    
    doc.addFileToVFS("Roboto-Regular.ttf", normalBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto");
  } catch (error) {
    console.warn("Could not load Roboto font:", error);
  }

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => isCompletedStatus(t.status)).length;
  const incompleteTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0';
  
  // Calculate average completion percentage
  const totalCompletionPercentage = tasks.reduce((sum, t) => sum + (t.completion_percentage || 0), 0);
  const avgCompletionPercentage = totalTasks > 0 ? (totalCompletionPercentage / totalTasks).toFixed(1) : '0';

  // Group and sort tasks
  const completed = tasks.filter(t => isCompletedStatus(t.status))
    .sort((a, b) => sortBy === 'name' ? a.title.localeCompare(b.title, 'vi') : 0);
  const incomplete = tasks.filter(t => !isCompletedStatus(t.status))
    .sort((a, b) => sortBy === 'name' ? a.title.localeCompare(b.title, 'vi') : 0);

  // ========== PAGE 1: SUMMARY WITH PIE CHART ==========
  // A4 landscape: 297mm x 210mm
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 15;

  doc.setFontSize(18);
  doc.setFont("Roboto", "bold");
  doc.text("BÁO CÁO TỔNG HỢP NHIỆM VỤ", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  doc.text(`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`, pageWidth / 2, 26, { align: "center" });

  // Left column: Statistics
  doc.setFontSize(12);
  doc.setFont("Roboto", "bold");
  doc.text("THỐNG KÊ TỔNG QUAN", margin, 42);

  doc.setFontSize(11);
  doc.setFont("Roboto", "normal");
  const statsStartY = 52;
  const lineHeight = 8;
  doc.text(`Tổng số nhiệm vụ: ${totalTasks}`, margin + 5, statsStartY);
  doc.text(`Đã hoàn thành: ${completedTasks}`, margin + 5, statsStartY + lineHeight);
  doc.text(`Chưa hoàn thành: ${incompleteTasks}`, margin + 5, statsStartY + lineHeight * 2);
  doc.text(`Tỷ lệ hoàn thành: ${completionRate}%`, margin + 5, statsStartY + lineHeight * 3);
  doc.text(`Tiến độ trung bình: ${avgCompletionPercentage}%`, margin + 5, statsStartY + lineHeight * 4);

  // Center: Pie chart
  const centerX = pageWidth / 2;
  const centerY = 75;
  const radius = 28;

  if (totalTasks > 0) {
    const completedAngle = (completedTasks / totalTasks) * 2 * Math.PI;
    
    doc.setFillColor(34, 197, 94);
    if (completedTasks > 0) {
      doc.ellipse(centerX, centerY, radius, radius, 'F');
    }
    
    if (incompleteTasks > 0) {
      doc.setFillColor(239, 68, 68);
      const incompleteRatio = incompleteTasks / totalTasks;
      const segments = 36;
      const angleStep = (incompleteRatio * 2 * Math.PI) / segments;
      
      for (let i = 0; i < segments; i++) {
        const angle1 = completedAngle - Math.PI / 2 + i * angleStep;
        const angle2 = completedAngle - Math.PI / 2 + (i + 1) * angleStep;
        
        const x1 = centerX + radius * Math.cos(angle1);
        const y1 = centerY + radius * Math.sin(angle1);
        const x2 = centerX + radius * Math.cos(angle2);
        const y2 = centerY + radius * Math.sin(angle2);
        
        doc.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
      }
    }
  } else {
    doc.text("Không có dữ liệu", centerX, centerY, { align: "center" });
  }

  // Right column: Legend
  const legendX = pageWidth - margin - 80;
  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  
  doc.setFillColor(34, 197, 94);
  doc.rect(legendX, 60, 8, 8, 'F');
  doc.text(`Hoàn thành: ${completedTasks}`, legendX + 12, 66);
  if (totalTasks > 0) {
    doc.text(`(${((completedTasks / totalTasks) * 100).toFixed(1)}%)`, legendX + 12, 73);
  }

  doc.setFillColor(239, 68, 68);
  doc.rect(legendX, 82, 8, 8, 'F');
  doc.text(`Chưa hoàn thành: ${incompleteTasks}`, legendX + 12, 88);
  if (totalTasks > 0) {
    doc.text(`(${((incompleteTasks / totalTasks) * 100).toFixed(1)}%)`, legendX + 12, 95);
  }

  // Progress bar section
  doc.setFontSize(11);
  doc.setFont("Roboto", "bold");
  doc.text("TIẾN ĐỘ TRUNG BÌNH", margin, 115);

  const barX = margin + 5;
  const barY = 122;
  const barWidth = pageWidth - margin * 2 - 10;
  const barHeight = 12;

  // Background bar
  doc.setFillColor(229, 231, 235);
  doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, 'F');

  // Progress bar
  if (totalTasks > 0) {
    const progressWidth = (Number(avgCompletionPercentage) / 100) * barWidth;
    doc.setFillColor(34, 197, 94);
    if (progressWidth > 0) {
      doc.roundedRect(barX, barY, progressWidth, barHeight, 2, 2, 'F');
    }
  }

  // Progress text - display outside the bar on the right
  doc.setFontSize(11);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${avgCompletionPercentage}%`, barX + barWidth + 8, barY + 8);

  // ========== PAGE 2: COMPLETED TASKS ==========
  if (completed.length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont("Roboto", "bold");
    doc.text(`NHIỆM VỤ ĐÃ HOÀN THÀNH (${completed.length})`, 20, 20);

    autoTable(doc, {
      head: [["STT", "Tiêu đề", "Dự án", "Người thực hiện", "Tiến độ", "Ưu tiên", "Ngày tạo", "Đến hạn"]],
      body: completed.map((task, index) => [
        index + 1,
        task.title,
        task.project_name || "",
        task.assignee_name || "Chưa phân công",
        `${task.completion_percentage || 0}%`,
        task.priority || "",
        task.created_at ? new Date(task.created_at).toLocaleDateString("vi-VN") : "",
        task.due_date ? new Date(task.due_date).toLocaleDateString("vi-VN") : ""
      ]),
      startY: 28,
      styles: { fontSize: 8, font: "Roboto", cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 55 },
        2: { cellWidth: 40 },
        3: { cellWidth: 35 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 22 },
        6: { cellWidth: 25 },
        7: { cellWidth: 25 },
      },
      tableWidth: 'auto',
      margin: { left: 14, right: 14 },
    });
  }

  // ========== PAGE 3: INCOMPLETE TASKS ==========
  if (incomplete.length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont("Roboto", "bold");
    doc.text(`NHIỆM VỤ CHƯA HOÀN THÀNH (${incomplete.length})`, 20, 20);

    autoTable(doc, {
      head: [["STT", "Tiêu đề", "Dự án", "Người thực hiện", "Tiến độ", "Trạng thái", "Ưu tiên", "Ngày tạo", "Đến hạn"]],
      body: incomplete.map((task, index) => [
        index + 1,
        task.title,
        task.project_name || "",
        task.assignee_name || "Chưa phân công",
        `${task.completion_percentage || 0}%`,
        getStatusLabel(task.status),
        task.priority || "",
        task.created_at ? new Date(task.created_at).toLocaleDateString("vi-VN") : "",
        task.due_date ? new Date(task.due_date).toLocaleDateString("vi-VN") : ""
      ]),
      startY: 28,
      styles: { fontSize: 8, font: "Roboto", cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 48 },
        2: { cellWidth: 35 },
        3: { cellWidth: 32 },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 28 },
        6: { cellWidth: 20 },
        7: { cellWidth: 22 },
        8: { cellWidth: 22 },
      },
      tableWidth: 'auto',
      margin: { left: 14, right: 14 },
    });
  }

  // Download
  doc.save(`bao_cao_nhiem_vu_${new Date().toISOString().split("T")[0]}.pdf`);
};

interface WarehouseAssetData {
  warehouse_name: string;
  asset_id: string;
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
}

interface WarehouseExportOptions {
  title: string;
  filename: string;
  fromDate: string;
  toDate: string;
  data: WarehouseAssetData[];
}

export const exportWarehouseToExcel = ({ title, filename, fromDate, toDate, data }: WarehouseExportOptions): void => {
  // Group data by warehouse
  const warehouseGroups: Record<string, WarehouseAssetData[]> = {};
  data.forEach(item => {
    const warehouse = item.warehouse_name || "KHO CHÍNH";
    if (!warehouseGroups[warehouse]) {
      warehouseGroups[warehouse] = [];
    }
    warehouseGroups[warehouse].push(item);
  });

  // Create worksheet data with headers and grouped rows
  const wsData: any[][] = [];

  // Title row
  wsData.push([title]);
  wsData.push([`Từ ngày ${fromDate} đến ngày ${toDate}`]);
  
  // Header rows
  wsData.push([
    "", "Mã hàng", "Tên hàng", "ĐVT",
    "Đầu kỳ", "", "Nhập kho", "", "Xuất kho", "", "Cuối kỳ", ""
  ]);
  wsData.push([
    "", "", "", "",
    "Số lượng", "Giá trị", "Số lượng", "Giá trị", "Số lượng", "Giá trị", "Số lượng", "Giá trị"
  ]);

  // Data rows grouped by warehouse
  Object.entries(warehouseGroups).forEach(([warehouseName, assets]) => {
    // Calculate warehouse totals
    const totals = assets.reduce((acc, asset) => ({
      opening_qty: acc.opening_qty + (asset.opening_quantity || 0),
      opening_val: acc.opening_val + (asset.opening_value || 0),
      inbound_qty: acc.inbound_qty + (asset.inbound_quantity || 0),
      inbound_val: acc.inbound_val + (asset.inbound_value || 0),
      outbound_qty: acc.outbound_qty + (asset.outbound_quantity || 0),
      outbound_val: acc.outbound_val + (asset.outbound_value || 0),
      closing_qty: acc.closing_qty + (asset.closing_quantity || 0),
      closing_val: acc.closing_val + (asset.closing_value || 0),
    }), {
      opening_qty: 0, opening_val: 0,
      inbound_qty: 0, inbound_val: 0,
      outbound_qty: 0, outbound_val: 0,
      closing_qty: 0, closing_val: 0
    });

    // Warehouse header row with totals
    wsData.push([
      `Tên kho : ${warehouseName} (${assets.length} )`,
      "", "", "",
      totals.opening_qty, totals.opening_val,
      totals.inbound_qty, totals.inbound_val,
      totals.outbound_qty, totals.outbound_val,
      totals.closing_qty, totals.closing_val
    ]);

    // Asset rows
    assets.forEach(asset => {
      wsData.push([
        "",
        asset.asset_id,
        asset.asset_name,
        asset.unit || "",
        asset.opening_quantity || 0,
        asset.opening_value || 0,
        asset.inbound_quantity || 0,
        asset.inbound_value || 0,
        asset.outbound_quantity || 0,
        asset.outbound_value || 0,
        asset.closing_quantity || 0,
        asset.closing_value || 0
      ]);
    });
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = [
    { wch: 40 }, // Warehouse/blank
    { wch: 15 }, // Mã hàng
    { wch: 50 }, // Tên hàng
    { wch: 8 },  // ĐVT
    { wch: 12 }, // Đầu kỳ SL
    { wch: 15 }, // Đầu kỳ GT
    { wch: 12 }, // Nhập SL
    { wch: 15 }, // Nhập GT
    { wch: 12 }, // Xuất SL
    { wch: 15 }, // Xuất GT
    { wch: 12 }, // Cuối kỳ SL
    { wch: 15 }, // Cuối kỳ GT
  ];

  // Merge title cells
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }, // Date range
    { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },  // Đầu kỳ header
    { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } },  // Nhập kho header
    { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } },  // Xuất kho header
    { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } }, // Cuối kỳ header
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tổng hợp tồn kho");

  // Download
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
};

export const exportWarehouseToPDF = async ({ title, filename, fromDate, toDate, data }: WarehouseExportOptions): Promise<void> => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Load and add Roboto font with Vietnamese support
  try {
    const fonts = await loadRobotoFont();
    const normalBase64 = arrayBufferToBase64(fonts.normal);
    const boldBase64 = arrayBufferToBase64(fonts.bold);
    
    doc.addFileToVFS("Roboto-Regular.ttf", normalBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    
    doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    
    doc.setFont("Roboto");
  } catch (error) {
    console.warn("Could not load Roboto font, using default font:", error);
    doc.setFont("helvetica");
  }

  // Add title
  doc.setFontSize(16);
  doc.setFont("Roboto", "bold");
  doc.text(title, 148.5, 15, { align: "center" });

  // Add date range
  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  doc.text(`Từ ngày ${fromDate} đến ngày ${toDate}`, 148.5, 22, { align: "center" });

  // Group data by warehouse
  const warehouseGroups: Record<string, WarehouseAssetData[]> = {};
  data.forEach(item => {
    const warehouse = item.warehouse_name || "KHO CHÍNH";
    if (!warehouseGroups[warehouse]) {
      warehouseGroups[warehouse] = [];
    }
    warehouseGroups[warehouse].push(item);
  });

  // Prepare table data
  const tableData: any[][] = [];
  
  Object.entries(warehouseGroups).forEach(([warehouseName, assets]) => {
    // Calculate warehouse totals
    const totals = assets.reduce((acc, asset) => ({
      opening_qty: acc.opening_qty + (asset.opening_quantity || 0),
      opening_val: acc.opening_val + (asset.opening_value || 0),
      inbound_qty: acc.inbound_qty + (asset.inbound_quantity || 0),
      inbound_val: acc.inbound_val + (asset.inbound_value || 0),
      outbound_qty: acc.outbound_qty + (asset.outbound_quantity || 0),
      outbound_val: acc.outbound_val + (asset.outbound_value || 0),
      closing_qty: acc.closing_qty + (asset.closing_quantity || 0),
      closing_val: acc.closing_val + (asset.closing_value || 0),
    }), {
      opening_qty: 0, opening_val: 0,
      inbound_qty: 0, inbound_val: 0,
      outbound_qty: 0, outbound_val: 0,
      closing_qty: 0, closing_val: 0
    });

    // Warehouse header row
    tableData.push([
      { content: `Tên kho : ${warehouseName} (${assets.length})`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: totals.opening_qty.toFixed(2), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: new Intl.NumberFormat("vi-VN").format(totals.opening_val), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: totals.inbound_qty.toFixed(2), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: new Intl.NumberFormat("vi-VN").format(totals.inbound_val), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: totals.outbound_qty.toFixed(2), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: new Intl.NumberFormat("vi-VN").format(totals.outbound_val), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: totals.closing_qty.toFixed(2), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: new Intl.NumberFormat("vi-VN").format(totals.closing_val), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
    ]);

    // Asset rows
    assets.forEach(asset => {
      tableData.push([
        "",
        asset.asset_id,
        asset.asset_name,
        asset.unit || "",
        (asset.opening_quantity || 0).toFixed(2),
        new Intl.NumberFormat("vi-VN").format(asset.opening_value || 0),
        (asset.inbound_quantity || 0).toFixed(2),
        new Intl.NumberFormat("vi-VN").format(asset.inbound_value || 0),
        (asset.outbound_quantity || 0).toFixed(2),
        new Intl.NumberFormat("vi-VN").format(asset.outbound_value || 0),
        (asset.closing_quantity || 0).toFixed(2),
        new Intl.NumberFormat("vi-VN").format(asset.closing_value || 0),
      ]);
    });
  });

  // Add table
  autoTable(doc, {
    head: [
      [
        { content: "", styles: { halign: 'center' } },
        { content: "Mã hàng", styles: { halign: 'center' } },
        { content: "Tên hàng", styles: { halign: 'center' } },
        { content: "ĐVT", styles: { halign: 'center' } },
        { content: "Đầu kỳ", colSpan: 2, styles: { halign: 'center' } },
        { content: "Nhập kho", colSpan: 2, styles: { halign: 'center' } },
        { content: "Xuất kho", colSpan: 2, styles: { halign: 'center' } },
        { content: "Cuối kỳ", colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        "", "", "", "",
        "Số lượng", "Giá trị",
        "Số lượng", "Giá trị",
        "Số lượng", "Giá trị",
        "Số lượng", "Giá trị"
      ]
    ],
    body: tableData,
    startY: 28,
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      font: "Roboto",
    },
    headStyles: {
      fillColor: [26, 183, 167],
      textColor: 255,
      fontStyle: "bold",
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 18 },
      2: { cellWidth: 55 },
      3: { cellWidth: 12 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 22 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 22 },
      10: { halign: 'right', cellWidth: 18 },
      11: { halign: 'right', cellWidth: 22 },
    },
  });

  // Download
  doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
};

// =====================================================
// DASHBOARD EXPORT FUNCTIONS
// =====================================================

interface DashboardExportData {
  projectName: string;
  stats: {
    total: number;
    completed: number;
    pending: number;
    avgProgress: number;
    completionRate: number;
  };
  employeeData: {
    name: string;
    completed: number;
    in_progress: number;
    pending: number;
    overdue: number;
  }[];
  priorityData: {
    name: string;
    value: number;
  }[];
  riskTasks: {
    title: string;
    assignee: string;
    dueDate: string;
    progress: number;
    status: string;
    daysOverdue: number;
  }[];
}

export const exportDashboardToExcel = (data: DashboardExportData): void => {
  const wb = XLSX.utils.book_new();

  // ========== SHEET 1: TỔNG QUAN ==========
  const overviewData: any[][] = [];
  overviewData.push(["DASHBOARD QUẢN TRỊ NHIỆM VỤ"]);
  overviewData.push([data.projectName]);
  overviewData.push([`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`]);
  overviewData.push([]);
  overviewData.push(["CHỈ SỐ TỔNG QUAN"]);
  overviewData.push(["", "Chỉ số", "Giá trị"]);
  overviewData.push(["", "Tổng nhiệm vụ", data.stats.total]);
  overviewData.push(["", "Hoàn thành", `${data.stats.completed} (${data.stats.completionRate}%)`]);
  overviewData.push(["", "Chưa hoàn thành", data.stats.pending]);
  overviewData.push(["", "Tiến độ TB hệ thống", `${data.stats.avgProgress}%`]);
  overviewData.push([]);
  
  // Visual progress bar
  const progressBar = "█".repeat(Math.round(data.stats.avgProgress / 5)) + "░".repeat(20 - Math.round(data.stats.avgProgress / 5));
  overviewData.push(["TIẾN ĐỘ TRỰC QUAN", `[${progressBar}]`, `${data.stats.avgProgress}%`]);
  overviewData.push([]);
  
  // Priority distribution
  overviewData.push(["PHÂN BỐ ĐỘ ƯU TIÊN"]);
  overviewData.push(["", "Mức độ", "Số lượng", "Tỷ lệ"]);
  const totalPriority = data.priorityData.reduce((sum, p) => sum + p.value, 0);
  data.priorityData.forEach(p => {
    overviewData.push(["", p.name, p.value, totalPriority > 0 ? `${((p.value / totalPriority) * 100).toFixed(1)}%` : "0%"]);
  });

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 15 }];
  wsOverview["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsOverview, "Tổng quan");

  // ========== SHEET 2: HIỆU SUẤT NHÂN VIÊN ==========
  const employeeSheetData: any[][] = [];
  employeeSheetData.push(["HIỆU SUẤT NHÂN VIÊN"]);
  employeeSheetData.push([]);
  employeeSheetData.push(["STT", "Tên nhân viên", "Đã xong", "Đang làm", "Chờ xử lý", "Quá hạn", "Tổng"]);
  
  data.employeeData.forEach((emp, index) => {
    const total = emp.completed + emp.in_progress + emp.pending + emp.overdue;
    employeeSheetData.push([
      index + 1,
      emp.name,
      emp.completed,
      emp.in_progress,
      emp.pending,
      emp.overdue,
      total
    ]);
  });
  
  if (data.employeeData.length === 0) {
    employeeSheetData.push(["", "Không có dữ liệu", "", "", "", "", ""]);
  }

  const wsEmployee = XLSX.utils.aoa_to_sheet(employeeSheetData);
  wsEmployee["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }];
  wsEmployee["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  XLSX.utils.book_append_sheet(wb, wsEmployee, "Hiệu suất NV");

  // ========== SHEET 3: NHIỆM VỤ CẦN CHÚ Ý ==========
  const riskSheetData: any[][] = [];
  riskSheetData.push(["NHIỆM VỤ CẦN CHÚ Ý - QUÁ HẠN / SẮP ĐẾN HẠN"]);
  riskSheetData.push([]);
  riskSheetData.push(["STT", "Nhiệm vụ", "Người phụ trách", "Hạn hoàn thành", "Tiến độ", "Trạng thái", "Ghi chú"]);
  
  data.riskTasks.forEach((task, index) => {
    const note = task.daysOverdue > 0 ? `Quá ${task.daysOverdue} ngày` : `Còn ${Math.abs(task.daysOverdue)} ngày`;
    riskSheetData.push([
      index + 1,
      task.title,
      task.assignee,
      task.dueDate,
      `${task.progress}%`,
      task.status,
      note
    ]);
  });
  
  if (data.riskTasks.length === 0) {
    riskSheetData.push(["", "✓ Không có nhiệm vụ nào cần chú ý", "", "", "", "", ""]);
  }

  const wsRisk = XLSX.utils.aoa_to_sheet(riskSheetData);
  wsRisk["!cols"] = [{ wch: 5 }, { wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
  wsRisk["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  XLSX.utils.book_append_sheet(wb, wsRisk, "Cần chú ý");

  // Download
  XLSX.writeFile(wb, `dashboard_nhiem_vu_${new Date().toISOString().split("T")[0]}.xlsx`);
};

export const exportDashboardToPDF = async (data: DashboardExportData): Promise<void> => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Load font with Vietnamese support
  let fontLoaded = false;
  try {
    const fonts = await loadRobotoFont();
    const normalBase64 = arrayBufferToBase64(fonts.normal);
    const boldBase64 = arrayBufferToBase64(fonts.bold);
    
    doc.addFileToVFS("Roboto-Regular.ttf", normalBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto");
    fontLoaded = true;
  } catch (error) {
    console.warn("Could not load Roboto font, using helvetica:", error);
    doc.setFont("helvetica");
  }
  
  const fontName = fontLoaded ? "Roboto" : "helvetica";

  // Load logo
  let logoBase64: string | null = null;
  try {
    logoBase64 = await loadImageAsBase64(logoKBA);
  } catch (error) {
    console.warn("Could not load logo:", error);
  }

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 15;

  // ========== PAGE 1: OVERVIEW ==========
  // Clean header design - white background with accent border
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 42, 'F');
  
  // Bottom border accent line
  doc.setFillColor(26, 183, 167);
  doc.rect(0, 40, pageWidth, 2, 'F');
  
  // Logo section - left side with proper sizing
  if (logoBase64) {
    try {
      // Logo with proper aspect ratio - original is roughly square with some width
      const logoHeight = 32;
      const logoWidth = 38; // Slightly wider than tall based on original
      doc.addImage(logoBase64, 'PNG', margin, 4, logoWidth, logoHeight);
    } catch (e) {
      console.warn("Could not add logo to PDF:", e);
    }
  }
  
  // Title section - right of logo, vertically centered
  const textStartX = margin + 50; // After logo
  
  doc.setTextColor(45, 55, 72); // Dark slate for text
  doc.setFontSize(18);
  doc.setFont(fontName, "bold");
  doc.text("DASHBOARD QUẢN TRỊ NHIỆM VỤ", textStartX, 16);
  
  doc.setFontSize(12);
  doc.setFont(fontName, "normal");
  doc.setTextColor(26, 183, 167); // Primary color for project name
  doc.text(data.projectName, textStartX, 26);
  
  // Date on the right side
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`, pageWidth - margin, 20, { align: "right" });

  doc.setTextColor(0, 0, 0);

  // ========== STATS CARDS ==========
  const cardWidth = 62;
  const cardHeight = 40;
  const cardY = 50; // Adjusted for new header height
  const cardSpacing = 6;
  const totalCardsWidth = 4 * cardWidth + 3 * cardSpacing;
  const startX = (pageWidth - totalCardsWidth) / 2;

  const statsCards = [
    { 
      label: "Tổng nhiệm vụ", 
      value: data.stats.total.toString(), 
      borderColor: [26, 183, 167], // primary
      iconBg: [204, 251, 241],
      iconColor: [26, 183, 167],
      iconType: "list" as const
    },
    { 
      label: "Hoàn thành", 
      value: data.stats.completed.toString(),
      subtext: `${data.stats.completionRate}%`,
      borderColor: [34, 197, 94],
      iconBg: [220, 252, 231],
      iconColor: [34, 197, 94],
      iconType: "check" as const
    },
    { 
      label: "Chưa hoàn thành", 
      value: data.stats.pending.toString(), 
      borderColor: [245, 158, 11],
      iconBg: [254, 243, 199],
      iconColor: [245, 158, 11],
      iconType: "clock" as const
    },
    { 
      label: "Tiến độ TB", 
      value: `${data.stats.avgProgress}%`, 
      borderColor: [59, 130, 246],
      iconBg: [219, 234, 254],
      iconColor: [59, 130, 246],
      iconType: "trend" as const
    },
  ];

  // Helper function to draw simple icons
  const drawIcon = (iconType: string, cx: number, cy: number, color: number[]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.5);

    switch (iconType) {
      case "list": // ListTodo icon - 3 horizontal lines with bullets
        [-2, 0, 2].forEach(offset => {
          doc.circle(cx - 3, cy + offset, 0.6, 'F');
          doc.line(cx - 1, cy + offset, cx + 3, cy + offset);
        });
        break;
      case "check": // CheckCircle icon - circle with checkmark
        doc.setLineWidth(0.6);
        doc.circle(cx, cy, 3.5, 'S');
        doc.line(cx - 1.5, cy, cx - 0.3, cy + 1.3);
        doc.line(cx - 0.3, cy + 1.3, cx + 2, cy - 1.2);
        break;
      case "clock": // Clock icon - circle with hands
        doc.setLineWidth(0.6);
        doc.circle(cx, cy, 3.5, 'S');
        doc.line(cx, cy, cx, cy - 2);
        doc.line(cx, cy, cx + 1.5, cy + 0.8);
        break;
      case "trend": // TrendingUp icon - upward arrow line
        doc.setLineWidth(0.6);
        doc.line(cx - 3, cy + 2, cx - 0.5, cy - 0.5);
        doc.line(cx - 0.5, cy - 0.5, cx + 0.5, cy + 0.5);
        doc.line(cx + 0.5, cy + 0.5, cx + 3, cy - 2);
        // Arrow head
        doc.line(cx + 3, cy - 2, cx + 1.5, cy - 1.5);
        doc.line(cx + 3, cy - 2, cx + 2.5, cy - 0.3);
        break;
    }
  };

  statsCards.forEach((card, index) => {
    const x = startX + index * (cardWidth + cardSpacing);
    
    // Card background - white with shadow effect
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 3, 3, 'FD');
    
    // Left border accent
    doc.setFillColor(card.borderColor[0], card.borderColor[1], card.borderColor[2]);
    doc.rect(x, cardY + 3, 2, cardHeight - 6, 'F');
    
    // Icon circle with icon inside
    const iconCx = x + cardWidth - 12;
    const iconCy = cardY + 12;
    doc.setFillColor(card.iconBg[0], card.iconBg[1], card.iconBg[2]);
    doc.circle(iconCx, iconCy, 6, 'F');
    
    // Draw icon inside circle
    drawIcon(card.iconType, iconCx, iconCy, card.iconColor);
    
    // Label text
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.text(card.label, x + 6, cardY + 12);
    
    // Value text
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.setFont(fontName, "bold");
    doc.text(card.value, x + 6, cardY + 28);
    
    // Subtext if exists (completion rate)
    if (card.subtext) {
      const subText = `(${card.subtext})`;
      doc.setTextColor(card.borderColor[0], card.borderColor[1], card.borderColor[2]);
      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      // Right-align inside card to avoid sticking to the main value
      doc.text(subText, x + cardWidth - 6, cardY + 28, { align: "right" });
    }
  });

  doc.setTextColor(0, 0, 0);

  // ========== CHARTS SECTION ==========
  // Section - Employee Performance (left side)
  const chartY = 97; // Adjusted position
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, chartY, 155, 100, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, chartY, 155, 100, 3, 3, 'S');
  
  doc.setTextColor(45, 55, 72);
  doc.setFontSize(11);
  doc.setFont(fontName, "bold");
  doc.text("So sánh hiệu suất nhân viên", margin + 5, chartY + 10);
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Phân bố trạng thái nhiệm vụ theo từng nhân viên", margin + 5, chartY + 17);

  if (data.employeeData.length > 0) {
    const empHeaders = [["Nhân viên", "Đã xong", "Đang làm", "Chờ xử lý", "Quá hạn", "Tổng"]];
    const empRows = data.employeeData.map(emp => [
      emp.name,
      emp.completed.toString(),
      emp.in_progress.toString(),
      emp.pending.toString(),
      emp.overdue.toString(),
      (emp.completed + emp.in_progress + emp.pending + emp.overdue).toString()
    ]);

    autoTable(doc, {
      head: empHeaders,
      body: empRows,
      startY: chartY + 21,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, font: fontName },
      headStyles: { fillColor: [26, 183, 167], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 15 },
      },
      margin: { left: margin + 5, right: pageWidth - margin - 150 },
    });
  } else {
    doc.setFontSize(9);
    doc.setFont(fontName, "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Không có dữ liệu nhân viên", margin + 10, chartY + 50);
  }

  // ========== PRIORITY PIE CHART (right side) ==========
  const rightColX = 178;
  
  // Card container for priority chart
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(rightColX, chartY, 104, 100, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightColX, chartY, 104, 100, 3, 3, 'S');
  
  doc.setTextColor(45, 55, 72);
  doc.setFontSize(11);
  doc.setFont(fontName, "bold");
  doc.text("Phân bố độ ưu tiên", rightColX + 5, chartY + 10);
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Tỷ lệ nhiệm vụ theo mức độ", rightColX + 5, chartY + 17);

  const priorityColors: Record<string, number[]> = {
    "Cao": [239, 68, 68],
    "Trung bình": [234, 179, 8],
    "Thấp": [34, 197, 94],
    "Chưa đặt": [156, 163, 175],
  };

  const totalPriority = data.priorityData.reduce((sum, p) => sum + p.value, 0);
  
  // Draw Pie Chart
  if (totalPriority > 0) {
    const centerX = rightColX + 52;
    const centerY = chartY + 55;
    const radius = 26;
    let startAngle = -Math.PI / 2;

    data.priorityData.forEach((p) => {
      if (p.value === 0) return;
      
      const color = priorityColors[p.name] || [156, 163, 175];
      const sliceAngle = (p.value / totalPriority) * 2 * Math.PI;
      
      doc.setFillColor(color[0], color[1], color[2]);
      
      const segments = 50;
      const angleStep = sliceAngle / segments;
      
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      
      for (let i = 0; i < segments; i++) {
        const angle1 = startAngle + i * angleStep;
        const angle2 = startAngle + (i + 1) * angleStep;
        
        const x1 = centerX + radius * Math.cos(angle1);
        const y1 = centerY + radius * Math.sin(angle1);
        const x2 = centerX + radius * Math.cos(angle2);
        const y2 = centerY + radius * Math.sin(angle2);
        
        doc.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
      }
      
      // Add percentage label
      const midAngle = startAngle + sliceAngle / 2;
      const labelRadius = radius * 0.65;
      const labelX = centerX + labelRadius * Math.cos(midAngle);
      const labelY = centerY + labelRadius * Math.sin(midAngle);
      
      const percentage = ((p.value / totalPriority) * 100).toFixed(0);
      if (Number(percentage) >= 10) {
        doc.setFontSize(8);
        doc.setFont(fontName, "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`${percentage}%`, labelX, labelY + 1, { align: "center" });
      }
      
      startAngle += sliceAngle;
    });

    // Donut center
    doc.setFillColor(250, 250, 250);
    doc.circle(centerX, centerY, radius * 0.42, 'F');
    
    doc.setFontSize(11);
    doc.setFont(fontName, "bold");
    doc.setTextColor(45, 55, 72);
    doc.text(totalPriority.toString(), centerX, centerY, { align: "center" });
    doc.setFontSize(6);
    doc.setFont(fontName, "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("nhiệm vụ", centerX, centerY + 5, { align: "center" });
  }

  // Legend - vertical list to prevent overlap (e.g. "Cao: 9  Trung bình: 26  Thấp: 3")
  const legendStartX = rightColX + 10;
  const legendStartY = chartY + 80;
  const legendRowGap = 6;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(7);
  doc.setFont(fontName, "normal");

  data.priorityData.forEach((p, idx) => {
    const color = priorityColors[p.name] || [156, 163, 175];
    const y = legendStartY + idx * legendRowGap;

    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(legendStartX, y, 2, 'F');

    doc.text(`${p.name}: ${p.value}`, legendStartX + 6, y + 1);
  });

  // ========== PAGE 2: RISK TASKS ==========
  doc.addPage();

  // Clean header for page 2 - consistent with page 1
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Bottom border accent - red for warning page
  doc.setFillColor(239, 68, 68);
  doc.rect(0, 33, pageWidth, 2, 'F');
  
  // Logo in header
  if (logoBase64) {
    try {
      const logoHeight = 26;
      const logoWidth = 31;
      doc.addImage(logoBase64, 'PNG', margin, 4, logoWidth, logoHeight);
    } catch (e) {
      console.warn("Could not add logo to page 2:", e);
    }
  }
  
  doc.setTextColor(185, 28, 28); // Red for warning title
  doc.setFontSize(16);
  doc.setFont(fontName, "bold");
  doc.text("NHIỆM VỤ CẦN CHÚ Ý", margin + 45, 18);

  // Card container for risk tasks
  doc.setFillColor(255, 250, 250);
  doc.roundedRect(margin, 42, pageWidth - margin * 2, pageHeight - 58, 3, 3, 'F');
  doc.setDrawColor(252, 180, 180);
  doc.roundedRect(margin, 42, pageWidth - margin * 2, pageHeight - 58, 3, 3, 'S');
  
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(9);
  doc.setFont(fontName, "normal");
  doc.text("Các nhiệm vụ quá hạn hoặc sắp đến hạn (trong 3 ngày tới)", margin + 5, 51);

  if (data.riskTasks.length > 0) {
    const riskHeaders = [["STT", "Nhiệm vụ", "Người phụ trách", "Hạn hoàn thành", "Tiến độ", "Trạng thái", "Ghi chú"]];
    const riskRows = data.riskTasks.map((task, index) => [
      (index + 1).toString(),
      task.title,
      task.assignee,
      task.dueDate,
      `${task.progress}%`,
      task.status,
      task.daysOverdue > 0 ? `Quá ${task.daysOverdue} ngày` : `Còn ${Math.abs(task.daysOverdue)} ngày`
    ]);

    autoTable(doc, {
      head: riskHeaders,
      body: riskRows,
      startY: 56,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, font: fontName },
      headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: "bold" },
      bodyStyles: { fillColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [254, 249, 249] },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 75 },
        2: { cellWidth: 45 },
        3: { cellWidth: 32 },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 28 },
        6: { cellWidth: 38 },
      },
      margin: { left: margin + 5, right: margin + 5 },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const rowIndex = hookData.row.index;
          if (data.riskTasks[rowIndex]?.daysOverdue > 0) {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [153, 27, 27];
          }
        }
      },
    });
  } else {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(margin + 10, 60, pageWidth - margin * 2 - 20, 35, 5, 5, 'F');
    
    doc.setFontSize(14);
    doc.setFont(fontName, "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("Tuyệt vời! Không có nhiệm vụ nào cần chú ý.", pageWidth / 2, 82, { align: "center" });
  }

  // Footer with logo
  const footerY = pageHeight - 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.text("Xuất bởi hệ thống quản lý KBA.2018", margin, footerY);
  doc.text(`${new Date().toLocaleString("vi-VN")}`, pageWidth - margin, footerY, { align: "right" });

  // Download
  doc.save(`dashboard_nhiem_vu_${new Date().toISOString().split("T")[0]}.pdf`);
};
