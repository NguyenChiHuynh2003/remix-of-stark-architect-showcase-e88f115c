import jsPDF from "jspdf";
import { loadRobotoFont, arrayBufferToBase64 } from "./pdfFonts";

export async function generateUserGuidePDF() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Load Vietnamese fonts
  const fonts = await loadRobotoFont();
  const normalFontBase64 = arrayBufferToBase64(fonts.normal);
  const boldFontBase64 = arrayBufferToBase64(fonts.bold);

  doc.addFileToVFS("NotoSans-Regular.ttf", normalFontBase64);
  doc.addFileToVFS("NotoSans-Bold.ttf", boldFontBase64);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  doc.setFont("NotoSans");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addNewPage = () => {
    doc.addPage();
    y = margin;
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      addNewPage();
    }
  };

  const addTitle = (text: string, size: number = 24) => {
    checkPageBreak(20);
    doc.setFontSize(size);
    doc.setFont("NotoSans", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text(text, pageWidth / 2, y, { align: "center" });
    y += size * 0.5 + 5;
  };

  const addSectionTitle = (text: string) => {
    checkPageBreak(15);
    doc.setFontSize(14);
    doc.setFont("NotoSans", "bold");
    doc.setTextColor(44, 62, 80);
    doc.text(text, margin, y);
    y += 8;
  };

  const addSubTitle = (text: string) => {
    checkPageBreak(12);
    doc.setFontSize(12);
    doc.setFont("NotoSans", "bold");
    doc.setTextColor(52, 73, 94);
    doc.text(text, margin + 5, y);
    y += 7;
  };

  const addParagraph = (text: string) => {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("NotoSans", "normal");
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    doc.text(lines, margin + 5, y);
    y += lines.length * 5 + 3;
  };

  const addBulletPoint = (text: string) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont("NotoSans", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("•", margin + 8, y);
    const lines = doc.splitTextToSize(text, contentWidth - 20);
    doc.text(lines, margin + 15, y);
    y += lines.length * 5 + 2;
  };

  const addDivider = () => {
    y += 3;
    doc.setDrawColor(189, 195, 199);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  // ========== PAGE 1: COVER ==========
  y = 60;
  addTitle("HƯỚNG DẪN SỬ DỤNG", 28);
  y += 10;
  addTitle("HỆ THỐNG QUẢN LÝ", 20);
  y += 30;

  doc.setFontSize(12);
  doc.setFont("NotoSans", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Phiên bản: 1.0", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.text(`Ngày cập nhật: ${new Date().toLocaleDateString("vi-VN")}`, pageWidth / 2, y, { align: "center" });

  // ========== PAGE 2: MỤC LỤC ==========
  addNewPage();
  addTitle("MỤC LỤC", 18);
  y += 5;

  const tocItems = [
    "1. Giới thiệu chung",
    "2. Đăng nhập hệ thống",
    "3. Module Tổng quan",
    "4. Module Nhân sự",
    "5. Module Quản lý Kho",
    "6. Quản lý người dùng",
    "7. Xuất báo cáo",
  ];

  tocItems.forEach((item) => {
    addParagraph(item);
  });

  // ========== PAGE 3: GIỚI THIỆU ==========
  addNewPage();
  addSectionTitle("1. GIỚI THIỆU CHUNG");
  addDivider();
  addParagraph(
    "Hệ thống Quản lý Doanh nghiệp là giải pháp toàn diện giúp doanh nghiệp quản lý các hoạt động kinh doanh bao gồm: Quản lý nhân sự, Quản lý kho hàng và tài sản, Theo dõi dự án và nhiều chức năng khác.",
  );
  y += 5;
  addSubTitle("Các module chính:");
  addBulletPoint("Tổng quan: Xem thống kê tổng quan về hoạt động doanh nghiệp");
  addBulletPoint("Nhân sự: Quản lý thông tin nhân viên, tài liệu nhân sự");
  addBulletPoint("Quản lý Kho: Quản lý tài sản, hàng hóa, nhập xuất kho");
  addBulletPoint("Cài đặt: Cấu hình hệ thống, sơ đồ tổ chức");
  addBulletPoint("Quản lý người dùng: Phân quyền truy cập cho người dùng");

  // ========== ĐĂNG NHẬP ==========
  y += 10;
  addSectionTitle("2. ĐĂNG NHẬP HỆ THỐNG");
  addDivider();
  addSubTitle("Bước 1: Truy cập trang đăng nhập");
  addParagraph("Mở trình duyệt web và truy cập địa chỉ website của hệ thống.");
  addSubTitle("Bước 2: Nhập thông tin đăng nhập");
  addBulletPoint("Email: Nhập địa chỉ email đã được cấp");
  addBulletPoint("Mật khẩu: Nhập mật khẩu của bạn");
  addSubTitle("Bước 3: Nhấn nút Đăng nhập");
  addParagraph("Sau khi đăng nhập thành công, bạn sẽ được chuyển đến trang Tổng quan.");

  // ========== MODULE TỔNG QUAN ==========
  addNewPage();
  addSectionTitle("3. MODULE TỔNG QUAN");
  addDivider();
  addParagraph(
    "Module Tổng quan cung cấp cái nhìn tổng thể về hoạt động của doanh nghiệp với các thống kê quan trọng.",
  );
  y += 3;
  addSubTitle("Các thông tin hiển thị:");
  addBulletPoint("Tổng số nhân viên hiện tại");
  addBulletPoint("Tổng số tài sản đang quản lý");
  addBulletPoint("Thống kê nhập xuất kho");
  addBulletPoint("Cảnh báo tồn kho thấp");
  addBulletPoint("Các hoạt động gần đây");

  // ========== MODULE NHÂN SỰ ==========
  y += 10;
  addSectionTitle("4. MODULE NHÂN SỰ");
  addDivider();
  addSubTitle("4.1 Danh sách nhân viên");
  addParagraph("Hiển thị danh sách tất cả nhân viên với các thông tin: Họ tên, Chức vụ, Phòng ban, Số điện thoại.");
  addSubTitle("4.2 Thêm nhân viên mới");
  addBulletPoint("Nhấn nút 'Thêm nhân viên'");
  addBulletPoint("Điền đầy đủ thông tin: Họ tên, Ngày sinh, Chức vụ, Phòng ban");
  addBulletPoint("Tải lên ảnh CMND/CCCD, Thẻ nhân viên, Chứng chỉ (nếu có)");
  addBulletPoint("Nhấn 'Lưu' để hoàn tất");
  addSubTitle("4.3 Chỉnh sửa thông tin nhân viên");
  addParagraph("Nhấn vào hàng nhân viên cần chỉnh sửa, cập nhật thông tin và nhấn 'Lưu'.");
  addSubTitle("4.4 Liên kết tài khoản người dùng");
  addParagraph("Trong phần quản lý nhân viên, bạn có thể liên kết nhân viên với tài khoản đăng nhập hệ thống.");

  // ========== MODULE QUẢN LÝ KHO ==========
  addNewPage();
  addSectionTitle("5. MODULE QUẢN LÝ KHO");
  addDivider();

  addSubTitle("5.1 Danh mục Tài sản");
  addParagraph("Quản lý danh sách tất cả tài sản của doanh nghiệp bao gồm: Thiết bị, Công cụ, Vật tư.");
  addBulletPoint("Xem danh sách tài sản với mã SKU, tên, loại, số lượng tồn kho");
  addBulletPoint("Thêm mới tài sản: Nhấn 'Thêm mới', điền thông tin và lưu");
  addBulletPoint("Import từ Excel: Tải file mẫu, điền dữ liệu và import");
  addBulletPoint("Xuất báo cáo Excel/PDF");

  y += 5;
  addSubTitle("5.2 Phiếu Nhập Kho (GRN)");
  addParagraph("Quản lý các phiếu nhập hàng vào kho.");
  addBulletPoint("Tạo phiếu nhập: Chọn tài sản, nhập số lượng, đơn giá");
  addBulletPoint("Import từ Excel: Hỗ trợ import hàng loạt từ file Excel");
  addBulletPoint("Xem lịch sử nhập kho theo thời gian");

  y += 5;
  addSubTitle("5.3 Phân Bổ & Xuất Kho");
  addParagraph("Chức năng này chia làm 2 phần:");
  addBulletPoint("Phân bổ tài sản: Giao tài sản cho nhân viên sử dụng. Tài sản CÓ THỂ hoàn trả lại kho");
  addBulletPoint("Xuất kho: Xuất vật tư tiêu hao. Tài sản KHÔNG THỂ hoàn trả");

  addSubTitle("Tạo phiếu phân bổ tài sản:");
  addBulletPoint("Chọn tài sản cần phân bổ");
  addBulletPoint("Chọn nhân viên nhận tài sản");
  addBulletPoint("Nhập mục đích sử dụng, ngày dự kiến hoàn trả");
  addBulletPoint("Nhấn 'Lưu' để tạo phiếu");

  addSubTitle("Tạo phiếu xuất kho:");
  addBulletPoint("Chọn tab 'Xuất Kho'");
  addBulletPoint("Tạo phiếu xuất mới với danh sách vật tư");
  addBulletPoint("Vật tư xuất kho sẽ được trừ vĩnh viễn khỏi tồn kho");

  y += 5;
  addSubTitle("5.4 Hoàn Trả Tài Sản");
  addParagraph("Xử lý việc nhân viên hoàn trả tài sản đã được phân bổ.");
  addBulletPoint("Chọn phiếu phân bổ cần hoàn trả");
  addBulletPoint("Nhập tình trạng tài sản khi hoàn trả");
  addBulletPoint("Xác nhận hoàn trả, tài sản sẽ được cập nhật lại vào kho");

  // ========== TIẾP TỤC QUẢN LÝ KHO ==========
  addNewPage();
  addSubTitle("5.5 Quản lý Danh mục");
  addParagraph("Thiết lập các danh mục hỗ trợ cho quản lý kho:");
  addBulletPoint("Danh mục sản phẩm: Phân loại tài sản theo nhóm");
  addBulletPoint("Thương hiệu: Quản lý các thương hiệu thiết bị");
  addBulletPoint("Nhóm sản phẩm: Gom nhóm sản phẩm cùng loại");
  addBulletPoint("Kho hàng: Quản lý các vị trí kho lưu trữ");

  y += 5;
  addSubTitle("5.6 Bảo trì Tài sản");
  addParagraph("Theo dõi lịch sử bảo trì, sửa chữa tài sản.");
  addBulletPoint("Ghi nhận các lần bảo trì với ngày, chi phí, người thực hiện");
  addBulletPoint("Xem tổng chi phí bảo trì theo từng tài sản");

  y += 5;
  addSubTitle("5.7 Thanh lý Tài sản");
  addParagraph("Xử lý thanh lý tài sản không còn sử dụng.");
  addBulletPoint("Chọn tài sản cần thanh lý");
  addBulletPoint("Nhập lý do, giá bán (nếu có)");
  addBulletPoint("Tài sản sẽ được chuyển sang trạng thái 'Đã thanh lý'");

  y += 5;
  addSubTitle("5.8 Khấu hao Tài sản");
  addParagraph("Theo dõi giá trị khấu hao của tài sản cố định theo thời gian.");

  // ========== QUẢN LÝ NGƯỜI DÙNG ==========
  y += 10;
  addSectionTitle("6. QUẢN LÝ NGƯỜI DÙNG");
  addDivider();
  addParagraph("(Chỉ dành cho Quản trị viên)");
  y += 3;

  addSubTitle("6.1 Tạo tài khoản mới");
  addBulletPoint("Nhấn 'Thêm người dùng'");
  addBulletPoint("Nhập Email và Mật khẩu");
  addBulletPoint("Chọn Vai trò: Quản trị viên, Kế toán, Hành chính nhân sự, Quản lý dự án, Người dùng");
  addBulletPoint("Nhấn 'Tạo' để hoàn tất");

  addSubTitle("6.2 Phân quyền truy cập");
  addParagraph("Cấu hình quyền truy cập cho từng người dùng:");
  addBulletPoint("Module được phép xem: Chọn các module người dùng có thể truy cập");
  addBulletPoint("Module được phép sửa: Chọn các module người dùng có thể chỉnh sửa dữ liệu");

  addSubTitle("6.3 Các vai trò mặc định");
  addBulletPoint("Quản trị viên: Toàn quyền truy cập và chỉnh sửa tất cả module");
  addBulletPoint("Hành chính nhân sự: Quản lý thông tin nhân viên");
  addBulletPoint("Người dùng: Quyền cơ bản, xem tổng quan");

  // ========== XUẤT BÁO CÁO ==========
  addNewPage();
  addSectionTitle("7. XUẤT BÁO CÁO");
  addDivider();
  addParagraph("Hệ thống hỗ trợ xuất báo cáo ở nhiều định dạng khác nhau.");

  y += 3;
  addSubTitle("7.1 Xuất Excel");
  addBulletPoint("Nhấn nút 'Xuất báo cáo' > 'Xuất Excel'");
  addBulletPoint("File Excel sẽ được tải về với đầy đủ dữ liệu");
  addBulletPoint("Có thể chỉnh sửa và in từ Excel");

  addSubTitle("7.2 Xuất PDF");
  addBulletPoint("Nhấn nút 'Xuất báo cáo' > 'Xuất PDF'");
  addBulletPoint("File PDF được định dạng sẵn để in ấn");
  addBulletPoint("Hỗ trợ đầy đủ tiếng Việt");

  addSubTitle("7.3 Các báo cáo có sẵn");
  addBulletPoint("Báo cáo tồn kho vật tư");
  addBulletPoint("Báo cáo danh sách tài sản");
  addBulletPoint("Báo cáo nhập xuất kho");
  addBulletPoint("Báo cáo phân bổ tài sản");
  addBulletPoint("Báo cáo danh sách nhân viên");

  // Footer on last page
  y = pageHeight - 20;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("© 2025 - Hệ thống Quản lý Doanh nghiệp", pageWidth / 2, y, { align: "center" });

  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Trang ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  // Save the PDF
  doc.save("Huong_Dan_Su_Dung_He_Thong.pdf");
}
