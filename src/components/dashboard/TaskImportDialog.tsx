import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Check, X, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import { sanitizeExcelImport } from "@/lib/excelSanitizer";

interface Project {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
}

interface ImportedTask {
  title: string;
  project_name: string;
  assignee_name: string;
  status: string;
  priority: string;
  due_date: string;
  description: string;
  isValid: boolean;
  errors: string[];
  matched_project_id?: string;
  matched_assignee_id?: string;
}

interface TaskImportDialogProps {
  projects: Project[];
  employees: Employee[];
  onImportSuccess: () => void;
}

export const TaskImportDialog = ({ projects, employees, onImportSuccess }: TaskImportDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importedTasks, setImportedTasks] = useState<ImportedTask[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const statusMap: Record<string, string> = {
    "Chờ xử lý": "pending",
    "Đang thực hiện": "in_progress",
    "Hoàn thành": "completed",
    "Quá hạn": "overdue",
  };

  const priorityMap: Record<string, string> = {
    Thấp: "low",
    "Trung bình": "medium",
    Cao: "high",
  };

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr) return null;

    // Handle DD/MM/YYYY format
    const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Handle YYYY-MM-DD format
    const yyyymmdd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) {
      return dateStr;
    }

    return null;
  };

  const findProjectByName = (name: string): Project | undefined => {
    return projects.find((p) => p.name.toLowerCase().trim() === name.toLowerCase().trim());
  };

  const findEmployeeByName = (name: string): Employee | undefined => {
    return employees.find((e) => e.full_name.toLowerCase().trim() === name.toLowerCase().trim());
  };

  const validateTask = (
    task: Omit<ImportedTask, "isValid" | "errors" | "matched_project_id" | "matched_assignee_id">,
  ): ImportedTask => {
    const errors: string[] = [];
    let matched_project_id: string | undefined;
    let matched_assignee_id: string | undefined;

    if (!task.title?.trim()) {
      errors.push("Thiếu tiêu đề");
    }

    if (!task.project_name?.trim()) {
      errors.push("Thiếu tên dự án");
    } else {
      const project = findProjectByName(task.project_name);
      if (!project) {
        errors.push(`Không tìm thấy dự án "${task.project_name}"`);
      } else {
        matched_project_id = project.id;
      }
    }

    if (task.assignee_name?.trim() && task.assignee_name !== "Chưa phân công") {
      const employee = findEmployeeByName(task.assignee_name);
      if (!employee) {
        errors.push(`Không tìm thấy nhân viên "${task.assignee_name}"`);
      } else {
        matched_assignee_id = employee.id;
      }
    }

    if (task.status && !statusMap[task.status]) {
      errors.push(`Trạng thái không hợp lệ: "${task.status}"`);
    }

    if (task.priority && !priorityMap[task.priority]) {
      errors.push(`Độ ưu tiên không hợp lệ: "${task.priority}"`);
    }

    return {
      ...task,
      isValid: errors.length === 0,
      errors,
      matched_project_id,
      matched_assignee_id,
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // Find the sheet with task data (skip summary sheets)
      let taskSheet = workbook.Sheets[workbook.SheetNames[0]];

      // Check if first sheet has "Tiêu đề" column, if not try other sheets
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (jsonData[0]?.includes("Tiêu đề")) {
          taskSheet = sheet;
          break;
        }
      }

      const jsonData = XLSX.utils.sheet_to_json(taskSheet) as Record<string, any>[];

      const tasks: ImportedTask[] = jsonData
        .filter((row) => row["Tiêu đề"]) // Skip empty rows
        .map((row) => {
          // Sanitize all string inputs to prevent formula injection
          const rawTask = {
            title: sanitizeExcelImport(row["Tiêu đề"]),
            project_name: sanitizeExcelImport(row["Dự án"]),
            assignee_name: sanitizeExcelImport(row["Người thực hiện"]),
            status: sanitizeExcelImport(row["Trạng thái"]),
            priority: sanitizeExcelImport(row["Ưu tiên"]),
            due_date: sanitizeExcelImport(row["Ngày đến hạn"]),
            description: sanitizeExcelImport(row["Mô tả"]),
          };
          return validateTask(rawTask);
        });

      if (tasks.length === 0) {
        toast({
          title: "Không tìm thấy dữ liệu",
          description: "File Excel không chứa nhiệm vụ hợp lệ",
          variant: "destructive",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      // Check if all tasks are valid - auto import
      const allValid = tasks.every((t) => t.isValid);
      if (allValid) {
        await autoImportTasks(tasks);
      } else {
        // Show preview for manual review
        setImportedTasks(tasks);
      }
    } catch (error: any) {
      toast({
        title: "Lỗi đọc file",
        description: error.message,
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const importTasks = async (tasksToImport: ImportedTask[]) => {
    if (!user) {
      toast({
        title: "Lỗi",
        description: "Bạn cần đăng nhập để nhập nhiệm vụ",
        variant: "destructive",
      });
      return false;
    }

    const validTasks = tasksToImport.filter((t) => t.isValid);
    if (validTasks.length === 0) {
      toast({
        title: "Không có nhiệm vụ hợp lệ",
        description: "Vui lòng kiểm tra lại dữ liệu",
        variant: "destructive",
      });
      return false;
    }

    try {
      const tasksData = validTasks.map((task) => ({
        title: task.title,
        description: task.description || null,
        status: (statusMap[task.status] || "pending") as "pending" | "in_progress" | "completed" | "overdue",
        priority: priorityMap[task.priority] || "medium",
        due_date: parseDate(task.due_date),
        project_id: task.matched_project_id!,
        assigned_to: task.matched_assignee_id || null,
        created_by: user.id,
      }));

      const { error } = await supabase.from("tasks").insert(tasksData);

      if (error) throw error;

      toast({
        title: "Nhập thành công",
        description: `Đã nhập ${validTasks.length} nhiệm vụ`,
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Lỗi nhập dữ liệu",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const autoImportTasks = async (tasks: ImportedTask[]) => {
    setIsImporting(true);
    const success = await importTasks(tasks);
    setIsImporting(false);

    if (success) {
      setOpen(false);
      setImportedTasks([]);
      setFileName("");
      onImportSuccess();
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    const success = await importTasks(importedTasks);
    setIsImporting(false);

    if (success) {
      setOpen(false);
      setImportedTasks([]);
      setFileName("");
      onImportSuccess();
    }
  };

  const validCount = importedTasks.filter((t) => t.isValid).length;
  const invalidCount = importedTasks.filter((t) => !t.isValid).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setImportedTasks([]);
          setFileName("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Nhập từ Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Nhập nhiệm vụ từ file Excel</DialogTitle>
          <DialogDescription>Chọn file Excel có định dạng tương tự file xuất ra để nhập nhiệm vụ</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload area */}
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium">Kéo thả hoặc chọn để chọn file</p>
                <p className="text-xs text-muted-foreground mt-1">Hỗ trợ file .xlsx, .xls</p>
              </>
            )}
          </div>

          {/* Preview table */}
          {importedTasks.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <Badge variant="outline" className="gap-1">
                    <Check className="w-3 h-3 text-green-500" />
                    Hợp lệ: {validCount}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <X className="w-3 h-3 text-red-500" />
                    Không hợp lệ: {invalidCount}
                  </Badge>
                </div>
              </div>

              <ScrollArea className="h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">TT</TableHead>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead>Dự án</TableHead>
                      <TableHead>Người thực hiện</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="w-[100px]">Kết quả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedTasks.map((task, index) => (
                      <TableRow key={index} className={task.isValid ? "" : "bg-destructive/5"}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{task.title}</TableCell>
                        <TableCell>{task.project_name}</TableCell>
                        <TableCell>{task.assignee_name || "-"}</TableCell>
                        <TableCell>{task.status}</TableCell>
                        <TableCell>
                          {task.isValid ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Check className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="cursor-help" title={task.errors.join(", ")}>
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Lỗi
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Error details */}
              {invalidCount > 0 && (
                <div className="bg-destructive/10 rounded-lg p-4">
                  <h4 className="font-medium text-destructive mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Chi tiết lỗi ({invalidCount} dòng)
                  </h4>
                  <ul className="text-sm space-y-1">
                    {importedTasks
                      .filter((t) => !t.isValid)
                      .slice(0, 5)
                      .map((task, i) => (
                        <li key={i} className="text-muted-foreground">
                          <strong>"{task.title || `Dòng ${importedTasks.indexOf(task) + 1}`}":</strong>{" "}
                          {task.errors.join(", ")}
                        </li>
                      ))}
                    {invalidCount > 5 && <li className="text-muted-foreground">...và {invalidCount - 5} lỗi khác</li>}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportedTasks([]);
                    setFileName("");
                  }}
                >
                  Hủy
                </Button>
                <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
                  {isImporting ? "Đang nhập..." : `Nhập ${validCount} nhiệm vụ`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
