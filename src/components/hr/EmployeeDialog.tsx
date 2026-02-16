import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Plus, ImageIcon, FileText } from "lucide-react";

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

interface UserProfile {
  id: string;
  full_name: string;
}

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSuccess: () => void;
}

interface PendingFile {
  file: File;
  preview: string;
}

interface PhotoUploadSectionProps {
  label: string;
  existingUrls: string[];
  pendingFiles: PendingFile[];
  onAddFiles: (files: FileList) => void;
  onRemoveExisting: (index: number) => void;
  onRemovePending: (index: number) => void;
  maxImages?: number;
  acceptPdf?: boolean;
}

const isPdfFile = (file: File | string): boolean => {
  if (typeof file === "string") {
    return file.toLowerCase().endsWith(".pdf") || file.includes("/pdf");
  }
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
};

const isPdfUrl = (url: string): boolean => {
  return url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("/pdf");
};

const PhotoUploadSection = ({
  label,
  existingUrls,
  pendingFiles,
  onAddFiles,
  onRemoveExisting,
  onRemovePending,
  maxImages,
  acceptPdf = false,
}: PhotoUploadSectionProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalImages = existingUrls.length + pendingFiles.length;
  const hasLimit = maxImages !== undefined && maxImages !== Infinity;
  const canAddMore = !hasLimit || totalImages < maxImages;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const acceptTypes = acceptPdf ? "image/*,.pdf,application/pdf" : "image/*";

  return (
    <div className="space-y-2">
      <Label>
        {label} {hasLimit ? `(${totalImages}/${maxImages})` : `(${totalImages})`}
        {acceptPdf && <span className="text-muted-foreground text-xs ml-1">(Ảnh hoặc PDF)</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {/* Existing files */}
        {existingUrls.map((url, index) => (
          <div key={`existing-${index}`} className="relative group">
            {isPdfUrl(url) ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-16 h-16 bg-muted rounded-lg border flex flex-col items-center justify-center gap-1 hover:bg-muted/80 transition-colors"
              >
                <FileText className="w-6 h-6 text-red-500" />
                <span className="text-[8px] text-muted-foreground">PDF</span>
              </a>
            ) : (
              <img src={url} alt={`${label} ${index + 1}`} className="w-16 h-16 object-cover rounded-lg border" />
            )}
            <button
              type="button"
              onClick={() => onRemoveExisting(index)}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Pending files previews */}
        {pendingFiles.map((pending, index) => (
          <div key={`pending-${index}`} className="relative group">
            {isPdfFile(pending.file) ? (
              <div className="w-16 h-16 bg-muted rounded-lg border-2 border-dashed border-primary flex flex-col items-center justify-center gap-1">
                <FileText className="w-6 h-6 text-red-500" />
                <span className="text-[8px] text-muted-foreground truncate max-w-14 px-1">
                  {pending.file.name.slice(0, 8)}...
                </span>
              </div>
            ) : (
              <img
                src={pending.preview}
                alt={`Pending ${index + 1}`}
                className="w-16 h-16 object-cover rounded-lg border-2 border-dashed border-primary"
              />
            )}
            <div className="absolute inset-0 bg-primary/20 rounded-lg flex items-center justify-center pointer-events-none">
              <span className="text-[10px] text-primary font-medium bg-background/80 px-1 rounded">Mới</span>
            </div>
            <button
              type="button"
              onClick={() => onRemovePending(index)}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-0.5 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Thêm</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={acceptTypes} multiple onChange={handleFileChange} className="hidden" />
    </div>
  );
};

export const EmployeeDialog = ({ open, onOpenChange, employee, onSuccess }: EmployeeDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    date_joined: new Date().toISOString().split("T")[0],
    position: "",
    department: "",
    phone: "",
    email: "",
    password: "",
    certificate_expiry_date: "",
    // New fields
    employee_code: "",
    address: "",
    gender: "",
    ethnicity: "",
    citizen_id: "",
    citizen_id_issue_date: "",
    citizen_id_issue_place: "",
    work_type: "",
    education_level: "",
    major: "",
    marital_status: "",
    emergency_contact: "",
    notes: "",
  });

  // Photo states - existing URLs
  const [employeeCardPhotos, setEmployeeCardPhotos] = useState<string[]>([]);
  const [idCardPhotos, setIdCardPhotos] = useState<string[]>([]);
  const [certificatePhotos, setCertificatePhotos] = useState<string[]>([]);

  // Photo states - pending files
  const [employeeCardPending, setEmployeeCardPending] = useState<PendingFile[]>([]);
  const [idCardPending, setIdCardPending] = useState<PendingFile[]>([]);
  const [certificatePending, setCertificatePending] = useState<PendingFile[]>([]);

  // URLs to delete
  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([]);

  const { toast } = useToast();

  // Fetch available user accounts
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (data) setUsers(data);
    };
    if (open) fetchUsers();
  }, [open]);

  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name,
        date_of_birth: employee.date_of_birth || "",
        date_joined: employee.date_joined,
        position: employee.position || "",
        department: employee.department || "",
        phone: employee.phone || "",
        email: "",
        password: "",
        certificate_expiry_date: employee.certificate_expiry_date || "",
        // New fields
        employee_code: employee.employee_code || "",
        address: employee.address || "",
        gender: employee.gender || "",
        ethnicity: employee.ethnicity || "",
        citizen_id: employee.citizen_id || "",
        citizen_id_issue_date: employee.citizen_id_issue_date || "",
        citizen_id_issue_place: employee.citizen_id_issue_place || "",
        work_type: employee.work_type || "",
        education_level: employee.education_level || "",
        major: employee.major || "",
        marital_status: employee.marital_status || "",
        emergency_contact: employee.emergency_contact || "",
        notes: employee.notes || "",
      });
      setSelectedUserId(employee.user_id);

      // Load existing photos (prefer array fields, fall back to legacy single URL)
      setEmployeeCardPhotos(
        employee.employee_card_photos?.length
          ? employee.employee_card_photos
          : employee.employee_card_photo_url
            ? [employee.employee_card_photo_url]
            : [],
      );
      setIdCardPhotos(
        employee.id_card_photos?.length
          ? employee.id_card_photos
          : employee.id_card_photo_url
            ? [employee.id_card_photo_url]
            : [],
      );
      setCertificatePhotos(
        employee.certificate_photos?.length
          ? employee.certificate_photos
          : employee.certificate_photo_url
            ? [employee.certificate_photo_url]
            : [],
      );
    } else {
      setFormData({
        full_name: "",
        date_of_birth: "",
        date_joined: new Date().toISOString().split("T")[0],
        position: "",
        department: "",
        phone: "",
        email: "",
        password: "",
        certificate_expiry_date: "",
        // New fields
        employee_code: "",
        address: "",
        gender: "",
        ethnicity: "",
        citizen_id: "",
        citizen_id_issue_date: "",
        citizen_id_issue_place: "",
        work_type: "",
        education_level: "",
        major: "",
        marital_status: "",
        emergency_contact: "",
        notes: "",
      });
      setSelectedUserId(null);
      setEmployeeCardPhotos([]);
      setIdCardPhotos([]);
      setCertificatePhotos([]);
    }

    // Reset pending files when dialog opens/closes
    setEmployeeCardPending([]);
    setIdCardPending([]);
    setCertificatePending([]);
    setUrlsToDelete([]);
  }, [employee, open]);

  const addPendingFiles = (
    files: FileList,
    existingCount: number,
    setPending: React.Dispatch<React.SetStateAction<PendingFile[]>>,
    pendingCount: number,
    maxImages: number = 5,
  ) => {
    const remainingSlots = maxImages - existingCount - pendingCount;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPending((prev) => [...prev, { file, preview: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadPhotos = async (pendingFiles: PendingFile[], folder: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const pending of pendingFiles) {
      const fileExt = pending.file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("employee-photos").upload(filePath, pending.file);

      if (!uploadError) {
        const { data } = supabase.storage.from("employee-photos").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
    }

    return uploadedUrls;
  };

  const deletePhotosFromStorage = async (urls: string[]) => {
    for (const url of urls) {
      try {
        const path = url.split("/employee-photos/")[1];
        if (path) {
          await supabase.storage.from("employee-photos").remove([path]);
        }
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userId = employee?.user_id || null;

      // Create user account if email and password provided
      if (!employee && formData.email && formData.password) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) throw new Error("Không có quyền truy cập");

        const response = await supabase.functions.invoke("admin-create-user", {
          body: {
            email: formData.email,
            password: formData.password,
            fullName: formData.full_name,
          },
        });

        if (response.error) throw response.error;
        userId = response.data?.user?.user?.id || null;
      }

      // Delete removed photos from storage
      if (urlsToDelete.length > 0) {
        await deletePhotosFromStorage(urlsToDelete);
      }

      // Upload new photos
      const newEmployeeCardUrls = await uploadPhotos(employeeCardPending, "employee-cards");
      const newIdCardUrls = await uploadPhotos(idCardPending, "id-cards");
      const newCertificateUrls = await uploadPhotos(certificatePending, "certificates");

      // Combine existing and new URLs
      const finalEmployeeCardPhotos = [...employeeCardPhotos, ...newEmployeeCardUrls];
      const finalIdCardPhotos = [...idCardPhotos, ...newIdCardUrls];
      const finalCertificatePhotos = [...certificatePhotos, ...newCertificateUrls];

      const finalUserId = employee ? selectedUserId || null : userId || null;

      const employeeData = {
        user_id: finalUserId || null,
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth || null,
        date_joined: formData.date_joined,
        position: formData.position || null,
        department: formData.department || null,
        phone: formData.phone || null,
        certificate_expiry_date: formData.certificate_expiry_date || null,
        // New fields
        employee_code: formData.employee_code || null,
        address: formData.address || null,
        gender: formData.gender || null,
        ethnicity: formData.ethnicity || null,
        citizen_id: formData.citizen_id || null,
        citizen_id_issue_date: formData.citizen_id_issue_date || null,
        citizen_id_issue_place: formData.citizen_id_issue_place || null,
        work_type: formData.work_type || null,
        education_level: formData.education_level || null,
        major: formData.major || null,
        marital_status: formData.marital_status || null,
        emergency_contact: formData.emergency_contact || null,
        notes: formData.notes || null,
        // Photo array fields
        employee_card_photos: finalEmployeeCardPhotos,
        id_card_photos: finalIdCardPhotos,
        certificate_photos: finalCertificatePhotos,
        // Keep legacy fields updated with first photo (for backward compatibility)
        employee_card_photo_url: finalEmployeeCardPhotos[0] || null,
        id_card_photo_url: finalIdCardPhotos[0] || null,
        certificate_photo_url: finalCertificatePhotos[0] || null,
      };

      if (employee) {
        const { error } = await supabase.from("employees").update(employeeData).eq("id", employee.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(employeeData);

        if (error) throw error;
      }

      toast({
        title: "Thành công",
        description: employee ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên mới",
      });

      onSuccess();
      onOpenChange(false);
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

  const handleRemoveExisting = (
    setPhotos: React.Dispatch<React.SetStateAction<string[]>>,
    photos: string[],
    index: number,
  ) => {
    const urlToRemove = photos[index];
    setUrlsToDelete((prev) => [...prev, urlToRemove]);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Chỉnh sửa nhân viên" : "Thêm nhân viên mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Thông tin cơ bản</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employee_code">Mã nhân viên</Label>
                <Input
                  id="employee_code"
                  value={formData.employee_code}
                  onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                  placeholder="VD: NV001"
                />
              </div>
              <div>
                <Label htmlFor="full_name">Họ tên *</Label>
                <Input
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="date_of_birth">Ngày sinh</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="gender">Giới tính</Label>
                <Select
                  value={formData.gender || ""}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn giới tính" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Nam">Nam</SelectItem>
                    <SelectItem value="Nữ">Nữ</SelectItem>
                    <SelectItem value="Khác">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ethnicity">Dân tộc</Label>
                <Input
                  id="ethnicity"
                  value={formData.ethnicity}
                  onChange={(e) => setFormData({ ...formData, ethnicity: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="marital_status">Tình trạng hôn nhân</Label>
                <Select
                  value={formData.marital_status || ""}
                  onValueChange={(value) => setFormData({ ...formData, marital_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tình trạng" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Độc thân">Độc thân</SelectItem>
                    <SelectItem value="Đã kết hôn">Đã kết hôn</SelectItem>
                    <SelectItem value="Ly hôn">Ly hôn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Nhập địa chỉ thường trú"
                />
              </div>
              <div>
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="emergency_contact">Liên hệ khẩn cấp</Label>
                <Input
                  id="emergency_contact"
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  placeholder="Tên - SĐT"
                />
              </div>
            </div>
          </div>

          {/* ID Card Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Thông tin CCCD/CMND</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="citizen_id">Số CCCD</Label>
                <Input
                  id="citizen_id"
                  value={formData.citizen_id}
                  onChange={(e) => setFormData({ ...formData, citizen_id: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="citizen_id_issue_date">Ngày cấp</Label>
                <Input
                  id="citizen_id_issue_date"
                  type="date"
                  value={formData.citizen_id_issue_date}
                  onChange={(e) => setFormData({ ...formData, citizen_id_issue_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="citizen_id_issue_place">Nơi cấp</Label>
                <Input
                  id="citizen_id_issue_place"
                  value={formData.citizen_id_issue_place}
                  onChange={(e) => setFormData({ ...formData, citizen_id_issue_place: e.target.value })}
                  placeholder="VD: Cục CS QLHC về TTXH"
                />
              </div>
            </div>
          </div>

          {/* Work Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Thông tin công việc</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date_joined">Ngày vào làm *</Label>
                <Input
                  id="date_joined"
                  type="date"
                  required
                  value={formData.date_joined}
                  onChange={(e) => setFormData({ ...formData, date_joined: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="work_type">Hình thức làm việc</Label>
                <Select
                  value={formData.work_type || ""}
                  onValueChange={(value) => setFormData({ ...formData, work_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn hình thức" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Toàn thời gian">Toàn thời gian</SelectItem>
                    <SelectItem value="Bán thời gian">Bán thời gian</SelectItem>
                    <SelectItem value="Thời vụ">Thời vụ</SelectItem>
                    <SelectItem value="Thử việc">Thử việc</SelectItem>
                    <SelectItem value="Hợp đồng">Hợp đồng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="position">Chức vụ</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="department">Phòng ban</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Education Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Trình độ học vấn</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="education_level">Trình độ học vấn</Label>
                <Select
                  value={formData.education_level || ""}
                  onValueChange={(value) => setFormData({ ...formData, education_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trình độ" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Tiểu học">Tiểu học</SelectItem>
                    <SelectItem value="THCS">THCS</SelectItem>
                    <SelectItem value="THPT">THPT</SelectItem>
                    <SelectItem value="Trung cấp">Trung cấp</SelectItem>
                    <SelectItem value="Cao đẳng">Cao đẳng</SelectItem>
                    <SelectItem value="Đại học">Đại học</SelectItem>
                    <SelectItem value="Thạc sĩ">Thạc sĩ</SelectItem>
                    <SelectItem value="Tiến sĩ">Tiến sĩ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="major">Chuyên ngành</Label>
                <Input
                  id="major"
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  placeholder="VD: Kế toán, CNTT..."
                />
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Tài khoản hệ thống</h3>
            <div className="grid grid-cols-2 gap-4">
              {employee ? (
                <div>
                  <Label htmlFor="user_account">Liên kết tài khoản</Label>
                  <Select
                    value={selectedUserId || "none"}
                    onValueChange={(value) => setSelectedUserId(value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn tài khoản người dùng" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="none">-- Không liên kết --</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="email">Email đăng nhập</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Để trống nếu không cần tài khoản"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Mật khẩu</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Để trống nếu không cần tài khoản"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ghi chú thêm về nhân viên..."
            />
          </div>

          {/* Photo upload sections */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium text-sm text-muted-foreground">Hình ảnh nhân viên</h3>

            <PhotoUploadSection
              label="Ảnh CMND/CCCD (mặt trước & sau)"
              existingUrls={idCardPhotos}
              pendingFiles={idCardPending}
              onAddFiles={(files) =>
                addPendingFiles(files, idCardPhotos.length, setIdCardPending, idCardPending.length)
              }
              onRemoveExisting={(index) => handleRemoveExisting(setIdCardPhotos, idCardPhotos, index)}
              onRemovePending={(index) => setIdCardPending((prev) => prev.filter((_, i) => i !== index))}
              maxImages={2}
            />

            <PhotoUploadSection
              label="Ảnh thẻ nhân viên"
              existingUrls={employeeCardPhotos}
              pendingFiles={employeeCardPending}
              onAddFiles={(files) =>
                addPendingFiles(files, employeeCardPhotos.length, setEmployeeCardPending, employeeCardPending.length)
              }
              onRemoveExisting={(index) => handleRemoveExisting(setEmployeeCardPhotos, employeeCardPhotos, index)}
              onRemovePending={(index) => setEmployeeCardPending((prev) => prev.filter((_, i) => i !== index))}
              maxImages={2}
            />

            <PhotoUploadSection
              label="Bằng cấp/chứng chỉ"
              existingUrls={certificatePhotos}
              pendingFiles={certificatePending}
              onAddFiles={(files) =>
                addPendingFiles(
                  files,
                  certificatePhotos.length,
                  setCertificatePending,
                  certificatePending.length,
                  Infinity,
                )
              }
              onRemoveExisting={(index) => handleRemoveExisting(setCertificatePhotos, certificatePhotos, index)}
              onRemovePending={(index) => setCertificatePending((prev) => prev.filter((_, i) => i !== index))}
              acceptPdf={true}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {employee ? "Cập nhật" : "Thêm mới"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
