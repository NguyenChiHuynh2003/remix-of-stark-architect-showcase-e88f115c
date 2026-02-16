// Vietnamese font support for jsPDF
// Using Noto Sans (full Vietnamese) bundled with the app

// Local font files served from /public/fonts
export const ROBOTO_NORMAL_URL = "/fonts/NotoSans-Regular.ttf";
export const ROBOTO_BOLD_URL = "/fonts/NotoSans-Bold.ttf";

export async function loadRobotoFont(): Promise<{ normal: ArrayBuffer; bold: ArrayBuffer }> {
  const [normalResponse, boldResponse] = await Promise.all([
    fetch(ROBOTO_NORMAL_URL),
    fetch(ROBOTO_BOLD_URL)
  ]);
  
  if (!normalResponse.ok || !boldResponse.ok) {
    throw new Error("Failed to load font files");
  }
  
  return {
    normal: await normalResponse.arrayBuffer(),
    bold: await boldResponse.arrayBuffer()
  };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
