
import { GoogleGenAI, Type } from "@google/genai";
import { CourseData, RoomData } from "../types";

export interface AIAnalysisResult {
  report: string;
  errorStts: string[];
  suggestions: { stt: string | number, room: string }[];
}

export const analyzeSchedule = async (courses: CourseData[], rooms: RoomData[]): Promise<AIAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const coursesSummary = courses.map(c => 
    `STT:${c.stt}|LHP:${c.sectionCode}|ĐK:${c.registeredCount}|Thứ:${c.dayOfWeek}|Tiết:${c.period}|Phòng:${c.room || 'NULL'}|Note:${c.duration}`
  ).join('\n');

  const roomsSummary = rooms.map(r => 
    `Phòng:${r.roomName}|SL:${r.capacity}`
  ).join('\n');

  const prompt = `
    Bạn là chuyên gia điều phối giảng đường đại học.
    
    YÊU CẦU CỰC KỲ QUAN TRỌNG:
    1. SỐ ĐĂNG KÝ (ĐK): Bạn phải dùng cột "ĐK" (Số đăng ký thật) để so sánh với sức chứa "SL" của phòng. KHÔNG dùng cột SV (nếu có).
    2. DANH SÁCH PHÒNG MASTER: Chỉ được gợi ý phòng có tên trong "DANH SÁCH PHÒNG TRƯỜNG CÓ".
    3. PHÒNG LẠ TRONG EXCEL: Nếu phòng gốc không có trong Master List, hãy giữ nguyên và không xếp lớp khác đè vào đó.
    4. KIỂM TRA TRÙNG: Một phòng không được có 2 lớp cùng lúc (trừ 7tuandau/7tuansau).
    5. SỨC CHỨA: Đảm bảo ĐK <= SL.

    --- LỊCH HỌC HIỆN TẠI (Ưu tiên cột ĐK) ---
    ${coursesSummary}

    --- DANH SÁCH PHÒNG TRƯỜNG CÓ (MASTER LIST) ---
    ${roomsSummary}

    YÊU CẦU ĐẦU RA (JSON):
    {
      "report": "Báo cáo chi tiết bằng tiếng Việt. Phân tích dựa trên Số Đăng ký (ĐK). Giải thích tại sao chọn phòng X cho lớp Y.",
      "errorStts": ["STT các lớp bị lỗi sức chứa (ĐK > SL) hoặc trùng lịch"],
      "suggestions": [{"stt": "STT", "room": "Tên phòng từ Master List"}]
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
      report: result.report || "Đã phân tích xong.",
      errorStts: Array.isArray(result.errorStts) ? result.errorStts.map(String) : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { report: "Lỗi kết nối AI.", errorStts: [], suggestions: [] };
  }
};
