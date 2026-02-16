import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Plus, Search, Pencil, Trash2, UserCheck, UserX, ImageIcon, Calendar, Briefcase, Phone, Building2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

const calculateSeniority = (dateJoined: string): string => {
  const joinDate = new Date(dateJoined);
  const now = new Date();

  const days = differenceInDays(now, joinDate);

  return `${days} ngày`;
};

import { EmployeeDialog } from "./EmployeeDialog";
import { EmployeePhotosViewer } from "./EmployeePhotosViewer";
import { ExportButtons } from "@/components/ExportButtons";
import { exportToExcel, exportToPDF, employeeExportConfig } from "@/lib/exportUtils";

interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  date_of_birth: string | null;
  date_joined: string;
  position: string | null;
  department: string | null;
  phone: string | null;
  employee_card_photo_url: string | null;
  id_card_photo_url: string | null;
  certificate_photo_url: string | null;
  certificate_expiry_date: string | null;
  employee_card_photos: string[] | null;
  id_card_photos: string[] | null;
  certificate_photos: string[] | null;
  // New fields
  employee_code: string | null;
  address: string | null;
  gender: string | null;
  ethnicity: string | null;
  citizen_id: string | null;
  citizen_id_issue_date: string | null;
  citizen_id_issue_place: string | null;
  work_type: string | null;
  education_level: string | null;
  major: string | null;
  marital_status: string | null;
  emergency_contact: string | null;
  notes: string | null;
}

export const EmployeeList = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [viewPhotosOpen, setViewPhotosOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();
  const { canEdit } = useUserRole();
  
  const canEditHR = canEdit("hr");

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;

    try {
      const { error } = await supabase.from("employees").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã xóa nhân viên",
      });
      fetchEmployees();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const getPhotoCount = (employee: Employee): number => {
    const employeeCardCount = employee.employee_card_photos?.length || (employee.employee_card_photo_url ? 1 : 0);
    const idCardCount = employee.id_card_photos?.length || (employee.id_card_photo_url ? 1 : 0);
    const certificateCount = employee.certificate_photos?.length || (employee.certificate_photo_url ? 1 : 0);
    return employeeCardCount + idCardCount + certificateCount;
  };

  const handleExportEmployees = async (format: "excel" | "pdf") => {
    const options = {
      title: "Báo cáo Nhân sự",
      filename: "bao_cao_nhan_su",
      ...employeeExportConfig,
      data: filteredEmployees,
      summary: [
        { label: "Tổng số nhân viên", value: filteredEmployees.length.toString() },
      ],
    };
    if (format === "excel") {
      exportToExcel(options);
    } else {
      await exportToPDF(options);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Danh sách nhân viên ({filteredEmployees.length})</CardTitle>
            <div className="flex gap-2">
              <ExportButtons
                onExportExcel={() => handleExportEmployees("excel")}
                onExportPDF={() => handleExportEmployees("pdf")}
                disabled={loading || filteredEmployees.length === 0}
              />
              {canEditHR && (
                <Button onClick={() => { setSelectedEmployee(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm nhân viên
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm nhân viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>STT</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Tài khoản</TableHead>
                  <TableHead>Ngày sinh</TableHead>
                  <TableHead>Ngày vào làm</TableHead>
                  <TableHead>Thâm niên</TableHead>
                  <TableHead>Chức vụ</TableHead>
                  <TableHead>Ảnh</TableHead>
                  {canEditHR && <TableHead>Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={canEditHR ? 9 : 8} className="text-center">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEditHR ? 9 : 8} className="text-center">
                      Chưa có nhân viên
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee, index) => {
                    const photoCount = getPhotoCount(employee);
                    return (
                      <TableRow key={employee.id}>
                        <TableCell className="text-center">{index + 1}</TableCell>
                        <TableCell>
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <span className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors">
                              {employee.full_name}
                            </span>
                          </HoverCardTrigger>
                            <HoverCardContent className="w-80" side="right">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-lg">{employee.full_name}</h4>
                                  {employee.user_id ? (
                                    <Badge variant="default" className="gap-1 text-xs">
                                      <UserCheck className="w-3 h-3" />
                                      Đã liên kết
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                      <UserX className="w-3 h-3" />
                                      Chưa liên kết
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid gap-2 text-sm">
                                  {employee.position && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Briefcase className="w-4 h-4" />
                                      <span>Chức vụ: <span className="text-foreground">{employee.position}</span></span>
                                    </div>
                                  )}
                                  
                                  {employee.department && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Building2 className="w-4 h-4" />
                                      <span>Phòng ban: <span className="text-foreground">{employee.department}</span></span>
                                    </div>
                                  )}
                                  
                                  {employee.date_of_birth && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="w-4 h-4" />
                                      <span>Ngày sinh: <span className="text-foreground">{format(new Date(employee.date_of_birth), "dd/MM/yyyy")}</span></span>
                                    </div>
                                  )}
                                  
                                  {employee.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Phone className="w-4 h-4" />
                                      <span>SĐT: <span className="text-foreground">{employee.phone}</span></span>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="w-4 h-4" />
                                    <span>Thâm niên: <Badge variant="outline" className="ml-1">{calculateSeniority(employee.date_joined)}</Badge></span>
                                  </div>
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </TableCell>
                        <TableCell>
                          {employee.user_id ? (
                            <Badge variant="default" className="gap-1">
                              <UserCheck className="w-3 h-3" />
                              Đã liên kết
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <UserX className="w-3 h-3" />
                              Chưa liên kết
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {employee.date_of_birth
                            ? format(new Date(employee.date_of_birth), "dd/MM/yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(employee.date_joined), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {calculateSeniority(employee.date_joined)}
                          </Badge>
                        </TableCell>
                        <TableCell>{employee.position || "-"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setViewingEmployee(employee);
                              setViewPhotosOpen(true);
                            }}
                          >
                            <ImageIcon className="w-4 h-4" />
                            {photoCount > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                {photoCount}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">0</span>
                            )}
                          </Button>
                        </TableCell>
                        {canEditHR && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(employee.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={selectedEmployee}
        onSuccess={fetchEmployees}
      />

      <EmployeePhotosViewer
        open={viewPhotosOpen}
        onOpenChange={setViewPhotosOpen}
        employee={viewingEmployee}
      />
    </>
  );
};