
import { GoogleGenAI, Type } from "@google/genai";
import { CourseData, RoomData } from "../types";

export interface AIAnalysisResult {
  report: string;
  suggestions: { stt: string | number, room: string }[];
}

export const analyzeSchedule = async (
  courses: CourseData[], 
  rooms: RoomData[],
  allowOverride: boolean,
  previousErrors: string[]
): Promise<AIAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const coursesSummary = courses.map(c => 
    `STT:${c.stt}|LHP:${c.sectionCode}|ĐK:${c.registeredCount}|Thứ:${c.dayOfWeek}|Tiết:${c.period}|Phòng:${c.room || 'NULL'}|AI_Suggest:${c.suggestedRoom || 'None'}|Status:${c.validationStatus}`
  ).join('\n');

  const roomsSummary = rooms.map(r => 
    `Phòng:${r.roomName}|SL:${r.capacity}`
  ).join('\n');

  const prompt = `
    Bạn là chuyên gia điều phối giảng đường đại học với thuật toán lặp thông minh.
    
    CHẾ ĐỘ CẤU HÌNH:
    - Cho phép sửa phòng đã có (Override): ${allowOverride ? "CÓ" : "KHÔNG"}.
    ${!allowOverride ? "- LƯU Ý: Những ô có dữ liệu 'Phòng' ban đầu (không phải NULL) là CỐ ĐỊNH, bạn KHÔNG ĐƯỢC phép đề xuất thay đổi. Chỉ được điền vào các ô NULL." : "- LƯU Ý: Bạn được phép đề xuất phòng mới cho TẤT CẢ các lớp để sửa lỗi và tối ưu hóa."}

    DANH SÁCH LỖI CẦN SỬA (PHẢN HỒI TỪ CODE VALIDATOR):
    ${previousErrors.length > 0 ? previousErrors.join('\n') : "Chưa có lỗi từ vòng lặp trước."}

    YÊU CẦU:
    1. LẤP ĐẦY Ô TRỐNG: Tất cả các lớp có Phòng='NULL' phải được gán phòng phù hợp.
    2. SỬA LỖI VI PHẠM: Nếu có danh sách lỗi ở trên, hãy tìm phòng khác thay thế ngay lập tức.
    3. NGUYÊN TẮC: ĐK (Số đăng ký) <= SL (Sức chứa). Không trùng Thứ/Tiết (trừ khi có 7tuandau/7tuansau).
    4. Chỉ dùng phòng trong DANH SÁCH MASTER.

    --- LỊCH HỌC (Ưu tiên cột ĐK) ---
    ${coursesSummary}

    --- DANH SÁCH PHÒNG MASTER ---
    ${roomsSummary}

    YÊU CẦU ĐẦU RA (JSON):
    {
      "report": "Giải trình ngắn gọn các thay đổi bạn vừa thực hiện để sửa lỗi ở vòng lặp này.",
      "suggestions": [{"stt": "STT", "room": "Tên phòng mới"}]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const result = JSON.parse(response.text || '{}');
    return {
      report: result.report || "Đã phân tích.",
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { report: "Lỗi kết nối.", suggestions: [] };
  }
};
