import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Employee {
  id: string;
  full_name: string;
  position: string | null;
  department: string | null;
}

interface EmployeeContract {
  id: string;
  employee_id: string;
  contract_type: string;
  start_work_date: string | null;
  contract_sign_date: string | null;
  contract_end_date: string | null;
  social_insurance_status: string | null;
  work_status: string | null;
  termination_date: string | null;
  notes: string | null;
  employees?: Employee;
}

const contractTypes = ["Hợp đồng thử việc", "Hợp đồng có thời hạn", "Hợp đồng không thời hạn", "Hợp đồng thời vụ"];

const socialInsuranceStatuses = ["Đang tham gia", "Chưa tham gia", "Đã nghỉ"];

const workStatuses = ["Đang làm việc", "Đã nghỉ việc", "Tạm nghỉ"];

export const EmployeeContractsManager = () => {
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<EmployeeContract | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    employee_id: "",
    contract_type: "",
    start_work_date: "",
    contract_sign_date: "",
    contract_end_date: "",
    social_insurance_status: "",
    work_status: "Đang làm việc",
    termination_date: "",
    notes: "",
  });

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_contracts")
        .select(
          `
          *,
          employees (
            id,
            full_name,
            position,
            department
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
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

  const fetchEmployees = async () => {
    const { data } = await supabase.from("employees").select("id, full_name, position, department").order("full_name");
    setEmployees(data || []);
  };

  useEffect(() => {
    fetchContracts();
    fetchEmployees();
  }, []);

  const resetForm = () => {
    setFormData({
      employee_id: "",
      contract_type: "",
      start_work_date: "",
      contract_sign_date: "",
      contract_end_date: "",
      social_insurance_status: "",
      work_status: "Đang làm việc",
      termination_date: "",
      notes: "",
    });
    setEditingContract(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        employee_id: formData.employee_id,
        contract_type: formData.contract_type,
        start_work_date: formData.start_work_date || null,
        contract_sign_date: formData.contract_sign_date || null,
        contract_end_date: formData.contract_end_date || null,
        social_insurance_status: formData.social_insurance_status || null,
        work_status: formData.work_status || null,
        termination_date: formData.termination_date || null,
        notes: formData.notes || null,
      };

      if (editingContract) {
        const { error } = await supabase.from("employee_contracts").update(payload).eq("id", editingContract.id);
        if (error) throw error;
        toast({ title: "Cập nhật thành công" });
      } else {
        const { error } = await supabase.from("employee_contracts").insert([payload]);
        if (error) throw error;
        toast({ title: "Thêm mới thành công" });
      }

      setDialogOpen(false);
      resetForm();
      fetchContracts();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (contract: EmployeeContract) => {
    setEditingContract(contract);
    setFormData({
      employee_id: contract.employee_id,
      contract_type: contract.contract_type,
      start_work_date: contract.start_work_date || "",
      contract_sign_date: contract.contract_sign_date || "",
      contract_end_date: contract.contract_end_date || "",
      social_insurance_status: contract.social_insurance_status || "",
      work_status: contract.work_status || "Đang làm việc",
      termination_date: contract.termination_date || "",
      notes: contract.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa hợp đồng này?")) return;

    try {
      const { error } = await supabase.from("employee_contracts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Xóa thành công" });
      fetchContracts();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  const getWorkStatusBadge = (status: string | null) => {
    switch (status) {
      case "Đang làm việc":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Đang làm việc</Badge>;
      case "Đã nghỉ việc":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Đã nghỉ việc</Badge>;
      case "Tạm nghỉ":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Tạm nghỉ</Badge>;
      default:
        return <Badge variant="outline">{status || "-"}</Badge>;
    }
  };

  const getSocialInsuranceBadge = (status: string | null) => {
    switch (status) {
      case "Đang tham gia":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Đang tham gia</Badge>;
      case "Chưa tham gia":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Chưa tham gia</Badge>;
      case "Đã nghỉ":
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Đã nghỉ</Badge>;
      default:
        return <Badge variant="outline">{status || "-"}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quản lý hợp đồng nhân viên ({contracts.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm hợp đồng
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Chức vụ</TableHead>
                  <TableHead>Phòng ban</TableHead>
                  <TableHead>Loại hợp đồng</TableHead>
                  <TableHead>Ngày vào làm</TableHead>
                  <TableHead>Ngày ký HĐ</TableHead>
                  <TableHead>Ngày hết hạn HĐ</TableHead>
                  <TableHead>Trạng thái BHXH</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày thôi việc</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center">
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang tải...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-4">
                      Chưa có hợp đồng nào
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((contract, index) => (
                    <TableRow key={contract.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{contract.employees?.full_name || "-"}</TableCell>
                      <TableCell>{contract.employees?.position || "-"}</TableCell>
                      <TableCell>{contract.employees?.department || "-"}</TableCell>
                      <TableCell>{contract.contract_type}</TableCell>
                      <TableCell>{formatDate(contract.start_work_date)}</TableCell>
                      <TableCell>{formatDate(contract.contract_sign_date)}</TableCell>
                      <TableCell>{formatDate(contract.contract_end_date)}</TableCell>
                      <TableCell>{getSocialInsuranceBadge(contract.social_insurance_status)}</TableCell>
                      <TableCell>{getWorkStatusBadge(contract.work_status)}</TableCell>
                      <TableCell>{formatDate(contract.termination_date)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(contract)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(contract.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? "Chỉnh sửa hợp đồng" : "Thêm hợp đồng mới"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nhân viên *</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhân viên" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Loại hợp đồng *</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại hợp đồng" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ngày vào làm</Label>
                <Input
                  type="date"
                  value={formData.start_work_date}
                  onChange={(e) => setFormData({ ...formData, start_work_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Ngày ký hợp đồng</Label>
                <Input
                  type="date"
                  value={formData.contract_sign_date}
                  onChange={(e) => setFormData({ ...formData, contract_sign_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Ngày hết hạn hợp đồng</Label>
                <Input
                  type="date"
                  value={formData.contract_end_date}
                  onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Trạng thái BHXH</Label>
                <Select
                  value={formData.social_insurance_status}
                  onValueChange={(value) => setFormData({ ...formData, social_insurance_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {socialInsuranceStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tình trạng làm việc</Label>
                <Select
                  value={formData.work_status}
                  onValueChange={(value) => setFormData({ ...formData, work_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tình trạng" />
                  </SelectTrigger>
                  <SelectContent>
                    {workStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ngày thôi việc</Label>
                <Input
                  type="date"
                  value={formData.termination_date}
                  onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting || !formData.employee_id || !formData.contract_type}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingContract ? "Cập nhật" : "Thêm mới"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
