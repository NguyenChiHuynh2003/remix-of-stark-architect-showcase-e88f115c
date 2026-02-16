import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateUserGuidePDF } from "@/lib/userGuideGenerator";
import { generateUserGuideWord } from "@/lib/userGuideWordGenerator";

export function UserGuideExport() {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await generateUserGuidePDF();
      toast.success("Đã tải xuống file hướng dẫn sử dụng (PDF)");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Lỗi khi tạo file PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportWord = async () => {
    setIsGeneratingWord(true);
    try {
      await generateUserGuideWord();
      toast.success("Đã tải xuống file hướng dẫn sử dụng (Word)");
    } catch (error) {
      console.error("Error generating Word:", error);
      toast.error("Lỗi khi tạo file Word");
    } finally {
      setIsGeneratingWord(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Hướng dẫn sử dụng
        </CardTitle>
        <CardDescription>Tải xuống tài liệu hướng dẫn sử dụng hệ thống ở định dạng Word hoặc PDF</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">File bao gồm hướng dẫn chi tiết về các chức năng:</p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Đăng nhập và quản lý tài khoản</li>
            <li>Module Tổng quan</li>
            <li>Module Nhân sự</li>
            <li>Module Quản lý Kho (Tài sản, Nhập kho, Xuất kho, Phân bổ)</li>
            <li>Quản lý người dùng và phân quyền</li>
            <li>Xuất báo cáo Excel/PDF</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleExportWord} disabled={isGeneratingWord} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingWord ? "Đang tạo Word..." : "Tải xuống (Word)"}
            </Button>
            <Button onClick={handleExportPDF} disabled={isGeneratingPDF} variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingPDF ? "Đang tạo PDF..." : "Tải xuống (PDF)"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
