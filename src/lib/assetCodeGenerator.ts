/**
 * Asset Code Generator
 * Quy chuẩn đặt tên mã hàng:
 * [Loại]-[Vị trí]-[Mã viết tắt]-[Thương hiệu?]-[Tuần/Năm]
 * 
 * Ví dụ:
 * - CC-I-MT-0226: Công cụ dụng cụ trong văn phòng - Máy tính - Tuần 02/2026
 * - CC-O-MK-0226: Công cụ dụng cụ ngoài công trình - Máy khoan - Tuần 02/2026
 * - VT-BL-M10-0126: Vật tư - Bu lông M10 - Tuần 01/2026
 * - CC-I-MT-DOP-0226: Máy tính Dell OptiPlex
 */

export type AssetCategory = "tools" | "equipment" | "materials";
export type AssetLocation = "I" | "O"; // I = Indoor/Văn phòng, O = Outdoor/Công trình

export const CATEGORY_OPTIONS: { value: AssetCategory; label: string; code: string }[] = [
  { value: "tools", label: "Công cụ dụng cụ (CC)", code: "CC" },
  { value: "equipment", label: "Thiết bị (CC)", code: "CC" },
  { value: "materials", label: "Vật tư (VT)", code: "VT" },
];

export const LOCATION_OPTIONS: { value: AssetLocation; label: string; icon: string }[] = [
  { value: "I", label: "Văn phòng", icon: "building" },
  { value: "O", label: "Công trình", icon: "hardhat" },
];

/**
 * Tạo mã viết tắt từ tên hàng hóa
 * Lấy chữ cái đầu của mỗi từ, tối đa 4 ký tự
 */
export function generateAbbreviation(name: string): string {
  if (!name.trim()) return "";
  
  // Loại bỏ các từ không quan trọng
  const excludeWords = ["và", "hoặc", "của", "cho", "với", "trong", "ngoài", "các", "những"];
  
  const words = name
    .trim()
    .split(/\s+/)
    .filter(word => !excludeWords.includes(word.toLowerCase()));
  
  // Lấy chữ cái đầu của mỗi từ
  let abbreviation = words
    .map(word => word.charAt(0).toUpperCase())
    .join("");
  
  // Giới hạn tối đa 4 ký tự
  return abbreviation.slice(0, 4);
}

/**
 * Tạo mã viết tắt cho thương hiệu
 * VD: "Dell OptiPlex" -> "DOP", "HP ProDesk" -> "HPPD"
 */
export function generateBrandAbbreviation(brand: string): string {
  if (!brand.trim()) return "";
  
  const words = brand.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Một từ: lấy 2-3 ký tự đầu
    return words[0].slice(0, 3).toUpperCase();
  }
  
  // Nhiều từ: lấy chữ đầu của từ đầu + 2 chữ cái đầu của từ tiếp theo
  let abbreviation = words[0].charAt(0).toUpperCase();
  for (let i = 1; i < words.length; i++) {
    abbreviation += words[i].slice(0, 2).toUpperCase();
  }
  
  return abbreviation.slice(0, 4);
}

/**
 * Lấy tuần hiện tại trong năm
 */
export function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
}

/**
 * Lấy 2 số cuối của năm hiện tại
 */
export function getCurrentYearShort(): string {
  return new Date().getFullYear().toString().slice(-2);
}

/**
 * Lấy mã loại tài sản
 */
export function getCategoryCode(assetType: AssetCategory): string {
  const category = CATEGORY_OPTIONS.find(c => c.value === assetType);
  return category?.code || "CC";
}

interface GenerateAssetCodeParams {
  assetName: string;
  assetType: AssetCategory;
  warehouseName?: string;
  brand?: string;
  location: AssetLocation;
}

/**
 * Tạo mã hàng theo quy chuẩn
 */
export function generateAssetCode({
  assetName,
  assetType,
  brand,
  location,
}: GenerateAssetCodeParams): string {
  const categoryCode = getCategoryCode(assetType);
  const nameAbbr = generateAbbreviation(assetName);
  const brandAbbr = brand ? generateBrandAbbreviation(brand) : "";
  const weekNum = getCurrentWeek().toString().padStart(2, "0");
  const year = getCurrentYearShort();
  const timeCode = `${weekNum}${year}`;
  
  // Xây dựng mã hàng
  const parts: string[] = [];
  
  // Loại tài sản (CC hoặc VT)
  parts.push(categoryCode);
  
  // Vị trí (chỉ thêm nếu là công cụ/thiết bị)
  if (assetType !== "materials") {
    parts.push(location);
  }
  
  // Mã viết tắt tên
  if (nameAbbr) {
    parts.push(nameAbbr);
  }
  
  // Thương hiệu (nếu có)
  if (brandAbbr) {
    parts.push(brandAbbr);
  }
  
  // Tuần/Năm
  parts.push(timeCode);
  
  return parts.join("-");
}

/**
 * Giải thích mã hàng
 */
export function getAssetCodeDescription(code: string): string {
  const parts = code.split("-");
  if (parts.length < 2) return "Mã không hợp lệ";
  
  const descriptions: string[] = [];
  
  // Loại tài sản
  if (parts[0] === "CC") {
    descriptions.push("Công cụ dụng cụ");
  } else if (parts[0] === "VT") {
    descriptions.push("Vật tư");
  }
  
  // Vị trí (nếu có)
  if (parts[1] === "I") {
    descriptions.push("trong văn phòng");
  } else if (parts[1] === "O") {
    descriptions.push("ngoài công trình");
  }
  
  // Thời gian (phần cuối)
  const timeCode = parts[parts.length - 1];
  if (timeCode && timeCode.length === 4) {
    const week = timeCode.slice(0, 2);
    const year = timeCode.slice(2, 4);
    descriptions.push(`nhập tuần ${week}/20${year}`);
  }
  
  return descriptions.join(", ");
}
