
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
  iteration: number
): Promise<AIAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 1. Lấy danh sách TARGET (Ưu tiên những lớp có ĐK cao nhất)
  const targetCourses = courses.filter(c => 
    c.validationStatus === 'violated' || 
    c.validationStatus === 'original_violated' || 
    (!c.room || c.room.toLowerCase() === 'null' || c.room.trim() === '')
  ).sort((a, b) => (Number(b.registeredCount) || 0) - (Number(a.registeredCount) || 0));

  if (targetCourses.length === 0) {
    return { report: "Hoàn tất: Không còn lớp nào cần xếp.", suggestions: [] };
  }

  // Lấy tối đa 300 lớp mỗi lượt để đảm bảo AI xử lý được trong 1 lần suy luận
  const batch = targetCourses.slice(0, 300);

  // 2. Tạo bản đồ "Slot trống" cho từng phòng
  const roomOccupancy: Record<string, Set<string>> = {};
  courses.forEach(c => {
    const rName = c.suggestedRoom || c.room;
    if (rName && rName.toLowerCase() !== 'null' && c.validationStatus === 'verified') {
      if (!roomOccupancy[rName]) roomOccupancy[rName] = new Set();
      roomOccupancy[rName].add(`${c.dayOfWeek}_${c.period}`);
    }
  });

  // Tóm tắt các phòng bận (đã được nén)
  const roomsSummary = rooms.map(r => {
    const occupied = Array.from(roomOccupancy[r.roomName] || []);
    return `${r.roomName}(Cap:${r.capacity})[Bận:${occupied.join(',')}]`;
  }).join('|');

  // 3. Nén danh sách TARGET cực độ
  const targetText = batch.map(c => `${c.stt}:${c.registeredCount}@T${c.dayOfWeek}:${c.period}`).join(' ');

  const prompt = `
    TASK: UNIVERSITY TIMETABLE TURBO FILLER (ITERATION ${iteration}).
    GOAL: Fill as many TARGETS as possible. Aim for 200+ assignments.

    --- ROOMS DATA (NAME(CAP)[BUSY_SLOTS]) ---
    ${roomsSummary}

    --- TARGET CLASSES (STT:REG_COUNT@DAY:PERIOD) ---
    ${targetText}

    STRICT RULES:
    1. A class at T2:1-3 can ONLY be put in a room NOT busy at '2_1-3'.
    2. Room Capacity >= Reg_Count.
    3. BE AGGRESSIVE: If a room is free at that time, ASSIGN IT. 
    4. RETURN AS MANY AS YOU CAN. If you skip a class, explain why in report.

    RESPONSE FORMAT (JSON):
    {
      "report": "Short summary",
      "results": { "STT": "ROOM_NAME", "STT": "ROOM_NAME", ... }
    }
    (Use 'results' as a simple Key-Value map for maximum token efficiency).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });
    
    const rawResult = JSON.parse(response.text || '{}');
    const suggestions: { stt: string | number, room: string }[] = [];
    
    if (rawResult.results) {
      Object.entries(rawResult.results).forEach(([stt, room]) => {
        suggestions.push({ stt, room: String(room) });
      });
    }

    return {
      report: rawResult.report || `Đã xử lý batch ${batch.length} lớp.`,
      suggestions
    };
  } catch (error) {
    console.error("Gemini Turbo Error:", error);
    return { report: "Lỗi xử lý hàng loạt.", suggestions: [] };
  }
};
