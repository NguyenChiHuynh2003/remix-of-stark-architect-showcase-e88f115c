 import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
 import { saveAs } from "file-saver";
 
 export async function generateUserGuideWord() {
   const doc = new Document({
     sections: [
       {
         properties: {},
         children: [
           // Title
           new Paragraph({
             children: [
               new TextRun({
                 text: "HƯỚNG DẪN SỬ DỤNG HỆ THỐNG",
                 bold: true,
                 size: 36,
                 color: "2563EB",
               }),
             ],
             heading: HeadingLevel.TITLE,
             alignment: AlignmentType.CENTER,
             spacing: { after: 200 },
           }),
           new Paragraph({
             children: [
               new TextRun({
                 text: "Phần mềm Quản lý Doanh nghiệp",
                 size: 28,
                 italics: true,
               }),
             ],
             alignment: AlignmentType.CENTER,
             spacing: { after: 400 },
           }),
 
           // Section 1: Login
           createHeading("1. ĐĂNG NHẬP VÀ QUẢN LÝ TÀI KHOẢN"),
           createBullet("Truy cập hệ thống qua đường dẫn được cung cấp"),
           createBullet("Nhập email và mật khẩu để đăng nhập"),
           createBullet("Liên hệ quản trị viên nếu quên mật khẩu"),
           createBullet("Đăng xuất bằng nút ở góc phải màn hình"),
           createSpacer(),
 
           // Section 2: Overview
           createHeading("2. MODULE TỔNG QUAN"),
           createBullet("Xem thống kê tổng quan về dự án, nhân sự, kho"),
           createBullet("Biểu đồ trực quan về tiến độ và hiệu suất"),
           createBullet("Thông báo và cảnh báo quan trọng"),
           createSpacer(),
 
           // Section 3: HR
           createHeading("3. MODULE NHÂN SỰ"),
           createBullet("Quản lý danh sách nhân viên"),
           createBullet("Thêm/sửa/xóa thông tin nhân viên"),
           createBullet("Upload ảnh CMND/CCCD, thẻ nhân viên, bằng cấp (hỗ trợ PDF và ảnh, không giới hạn số lượng)"),
           createBullet("Theo dõi ngày hết hạn chứng chỉ"),
           createBullet("Liên kết tài khoản đăng nhập với nhân viên"),
           createBullet("Xem nhanh thông tin nhân viên khi di chuột qua tên"),
           createSpacer(),
 
           // Section 4: Inventory
           createHeading("4. MODULE QUẢN LÝ KHO"),
           createSubHeading("4.1 Danh sách tài sản"),
           createBullet("Quản lý thiết bị, công cụ, vật tư"),
           createBullet("Thêm/sửa/xóa tài sản"),
           createBullet("Theo dõi số lượng tồn kho"),
           createBullet("Xuất báo cáo Excel/PDF"),
           
           createSubHeading("4.2 Nhập kho (GRN)"),
           createBullet("Tạo phiếu nhập kho từ nhà cung cấp"),
           createBullet("Import dữ liệu từ Excel"),
           createBullet("Theo dõi lịch sử nhập kho"),
           
           createSubHeading("4.3 Xuất kho (GIN)"),
           createBullet("Tạo phiếu xuất kho cho dự án/nhân viên"),
           createBullet("Theo dõi số lượng đã xuất"),
           createBullet("Quản lý hoàn trả vật tư"),
           
           createSubHeading("4.4 Phân bổ tài sản"),
           createBullet("Giao tài sản cho nhân viên sử dụng"),
           createBullet("Theo dõi ngày dự kiến hoàn trả"),
           createBullet("Xử lý hoàn trả và đánh giá tình trạng"),
           createSpacer(),
 
           // Section 5: Projects
           createHeading("5. MODULE DỰ ÁN"),
           createBullet("Tạo và quản lý dự án"),
           createBullet("Theo dõi tiến độ công việc"),
           createBullet("Quản lý yêu cầu khách hàng"),
           createBullet("Quản lý hạng mục công việc"),
           createBullet("Báo cáo KPI dự án"),
           createSpacer(),
 
           // Section 6: Accounting
           createHeading("6. MODULE KẾ TOÁN"),
           createBullet("Quản lý hợp đồng"),
           createBullet("Theo dõi bảo lãnh"),
           createBullet("Ghi nhận giao dịch thu/chi"),
           createSpacer(),
 
           // Section 7: Settings
           createHeading("7. MODULE CÀI ĐẶT"),
           createSubHeading("7.1 Sơ đồ tổ chức"),
           createBullet("Thiết kế cơ cấu tổ chức doanh nghiệp"),
           createBullet("Kéo thả vị trí trên canvas"),
           createBullet("Gán nhân viên vào vị trí"),
           
           createSubHeading("7.2 Quản lý danh mục kho"),
           createBullet("Danh mục sản phẩm"),
           createBullet("Nhóm sản phẩm"),
           createBullet("Thương hiệu"),
           createBullet("Kho hàng"),
           
           createSubHeading("7.3 Sao lưu dữ liệu"),
           createBullet("Cấu hình sao lưu tự động"),
           createBullet("Khôi phục dữ liệu từ bản sao lưu"),
           createSpacer(),
 
           // Section 8: User Management
           createHeading("8. QUẢN LÝ NGƯỜI DÙNG VÀ PHÂN QUYỀN"),
           createBullet("Chỉ Admin mới có quyền quản lý người dùng"),
           createBullet("Tạo tài khoản mới cho nhân viên"),
           createBullet("Phân quyền truy cập theo module"),
           createBullet("Phân quyền: Chỉ xem hoặc Chỉnh sửa"),
           createBullet("Người dùng chỉ xem sẽ không thấy cột Thao tác"),
           createSpacer(),
 
           // Section 9: Export
           createHeading("9. XUẤT BÁO CÁO"),
           createBullet("Xuất dữ liệu sang Excel (.xlsx)"),
           createBullet("Xuất báo cáo PDF"),
           createBullet("Hỗ trợ font tiếng Việt đầy đủ"),
           createSpacer(),
 
           // Footer
           new Paragraph({
             children: [
               new TextRun({
                 text: `Tài liệu được tạo ngày: ${new Date().toLocaleDateString("vi-VN")}`,
                 size: 20,
                 color: "666666",
                 italics: true,
               }),
             ],
             spacing: { before: 400 },
             border: {
               top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
             },
           }),
         ],
       },
     ],
   });
 
   const blob = await Packer.toBlob(doc);
   saveAs(blob, "Huong-dan-su-dung.docx");
 }
 
 function createHeading(text: string): Paragraph {
   return new Paragraph({
     children: [
       new TextRun({
         text,
         bold: true,
         size: 28,
         color: "1E40AF",
       }),
     ],
     heading: HeadingLevel.HEADING_1,
     spacing: { before: 300, after: 150 },
   });
 }
 
 function createSubHeading(text: string): Paragraph {
   return new Paragraph({
     children: [
       new TextRun({
         text,
         bold: true,
         size: 24,
         color: "3B82F6",
       }),
     ],
     heading: HeadingLevel.HEADING_2,
     spacing: { before: 200, after: 100 },
   });
 }
 
 function createBullet(text: string): Paragraph {
   return new Paragraph({
     children: [
       new TextRun({
         text: `• ${text}`,
         size: 22,
       }),
     ],
     spacing: { before: 50, after: 50 },
     indent: { left: 360 },
   });
 }
 
 function createSpacer(): Paragraph {
   return new Paragraph({
     children: [],
     spacing: { after: 100 },
   });
 }