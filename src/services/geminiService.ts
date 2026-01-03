
import { GoogleGenAI, Type } from "@google/genai";
import { CourseData, RoomData } from "../types";

export interface AIAnalysisResult {
  report: string;
  debugPrompt?: string;
  suggestions: { stt: string | number, room: string }[];
  errorType?: 'QUOTA' | 'OTHER';
}

export type AISolveMode = 'FILLING' | 'REPAIRING';

export const analyzeSchedule = async (
  courses: CourseData[], 
  rooms: RoomData[],
  mode: AISolveMode,
  iteration: number,
  apiKey?: string
): Promise<AIAnalysisResult> => {
  // Lấy API key từ parameter hoặc environment
  const finalApiKey = apiKey || process.env.API_KEY;
  if (!finalApiKey) {
    throw new Error('Không tìm thấy API Key. Vui lòng nhập API Key.');
  }
  const ai = new GoogleGenAI({ apiKey: finalApiKey });
  const modelName = 'gemini-3-flash-preview';

  let targetCourses = [];
  
  if (mode === 'FILLING') {
    targetCourses = courses.filter(c => 
      (!c.room || c.room.toLowerCase() === 'null' || c.room.trim() === '') && 
      !c.suggestedRoom
    );
  } else {
    // REPAIRING: tìm cả lỗi (violated) VÀ các cơ hội tối ưu
    // 1. Các lớp có lỗi (violated)
    const violatedCourses = courses.filter(c => 
      c.suggestedRoom && c.validationStatus === 'violated'
    );
    
    // 2. Các lớp đang trong phòng quá tải hoặc sparse (cơ hội để tối ưu)
    const roomUsage = new Map<string, number>();
    courses.forEach(c => {
      const r = (c.suggestedRoom || c.room || "").trim().toLowerCase();
      if (r && r !== 'null' && (c.validationStatus === 'verified' || (!c.suggestedRoom && c.room))) {
        roomUsage.set(r, (roomUsage.get(r) || 0) + 1);
      }
    });
    
    // Tìm phòng quá tải (>6 slots) hoặc sparse (<3 slots) để consolidate
    const candidates = new Set<string>();
    roomUsage.forEach((usage, room) => {
      if (usage > 6 || usage < 3) candidates.add(room); // Overfilled hoặc sparse
    });
    
    // Các lớp trong phòng quá tải/sparse - ưu tiên lớp many students
    let optimizationCourses = courses.filter(c => {
      const r = (c.suggestedRoom || c.room || "").trim().toLowerCase();
      return r && r !== 'null' && candidates.has(r) && c.validationStatus === 'verified';
    }).sort((a, b) => (Number(b.registeredCount) || 0) - (Number(a.registeredCount) || 0));
    
    // Nếu không có violated/overfilled, chọn vài lớp random để xem có cơ hội tối ưu
    if (violatedCourses.length === 0 && optimizationCourses.length === 0) {
      optimizationCourses = courses.filter(c => c.validationStatus === 'verified')
        .sort((a, b) => (Number(b.registeredCount) || 0) - (Number(a.registeredCount) || 0))
        .slice(0, Math.min(15, courses.length));
    } else if (optimizationCourses.length > 0) {
      // Limit optimization courses để không quá nhiều
      optimizationCourses = optimizationCourses.slice(0, Math.min(30, optimizationCourses.length));
    }
    
    targetCourses = [...violatedCourses, ...optimizationCourses];
  }

  if (targetCourses.length === 0) return { report: "Hoàn tất", suggestions: [] };

  targetCourses.sort((a, b) => (Number(b.registeredCount) || 0) - (Number(a.registeredCount) || 0));
  const batch = targetCourses;

  const occupancyMap = new Map<string, Set<string>>();
  courses.forEach(c => {
    const r = (c.suggestedRoom || c.room || "").trim().toLowerCase();
    if (r && r !== 'null' && (c.validationStatus === 'verified' || (!c.suggestedRoom && c.room))) {
      if (!occupancyMap.has(r)) occupancyMap.set(r, new Set());
      const slotCode = `${c.dayOfWeek}${String(c.period).split('-')[0]}`;
      occupancyMap.get(r)!.add(slotCode);
    }
  });

  const getSlotCode = (day: any, period: string) => `${day}${String(period).split('-')[0]}`;
  const days = ["2", "3", "4", "5", "6", "7"];
  const periods = ["1-3", "4-6", "7-9", "10-12"];

  const compressedRooms = rooms.map(r => {
    const rKey = r.roomName.toLowerCase();
    const freeSlots = [];
    for (const d of days) {
      for (const p of periods) {
        if (!occupancyMap.get(rKey)?.has(getSlotCode(d, p))) {
          freeSlots.push(getSlotCode(d, p));
        }
      }
    }
    return freeSlots.length ? `${r.roomName}(${r.capacity}/${freeSlots.length})[${freeSlots.join(',')}]` : null;
  }).filter(Boolean)
    .sort((a, b) => {
      const aFree = parseInt(a.match(/\/(\d+)/)?.[1] || '0');
      const bFree = parseInt(b.match(/\/(\d+)/)?.[1] || '0');
      return bFree - aFree; // Sort by free slots descending
    })
    .join('|');

  const compressedTargets = batch.map(c => 
    `${c.stt}:${c.registeredCount}@${getSlotCode(c.dayOfWeek, c.period)}`
  ).join(' ');

  const modeInstructions = mode === 'FILLING' 
    ? `- FILL unassigned courses with best available rooms
- MUST assign at least 1 course per API call
- Prioritize courses with more students (listed first by student count)`
    : `- FIX conflicting assignments (violated status) if any exist
- OPTIMIZE room distribution: 
  * Move courses OUT of overfilled rooms (>6 slots) to available ones
  * Move courses OUT of sparse rooms (<3 slots) to consolidate
  * Try to find better room matches (e.g. smaller room if too big)
- Each move should improve overall utilization
- If no violations/overfilled, propose at least 1-3 optimization moves`;

  const prompt = `You are a SCHEDULE OPTIMIZER. Your task:
ROOMS (name/free_slots/available_times): ${compressedRooms}
COURSES_TO_ASSIGN (STT:students@required_time): ${compressedTargets}

RULES:
1. ONLY suggest available time slots for each course
2. Prioritize rooms with MORE FREE SLOTS (listed first)
3. Match student count with room capacity when possible
4. Return ONLY valid room assignments (no conflicts)
5. Maximize room utilization and reduce fragmentation

MODE: ${mode}
${modeInstructions}

CRITICAL: You MUST return at least 1 assignment in the JSON response. If a course cannot be assigned to the exact required time, try nearby times. Do not return empty results.

RESPONSE: Return ONLY this JSON format:
{"res":{"STT1":"ROOM1","STT2":"ROOM2",...}}

NOW: Analyze courses and assign them to rooms. MUST provide at least 1 assignment.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    
    const text = response.text || '{}';
    const data = JSON.parse(text);
    const suggestions = Object.entries(data.res || {}).map(([stt, room]) => ({ 
      stt: stt.replace(/[!?]/g, ''), 
      room: String(room) 
    }));

    return {
      report: `Xếp được: ${suggestions.length}/${batch.length} lớp.`,
      debugPrompt: `Batch: ${batch.length}`,
      suggestions
    };
  } catch (e: any) {
    const errorStr = JSON.stringify(e);
    if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("quota")) {
      return { 
        report: "⚠️ Hết hạn mức API (429). Đang tạm dừng...", 
        suggestions: [],
        errorType: 'QUOTA'
      };
    }
    return { report: `Lỗi AI: ${e.message || "Không xác định"}`, suggestions: [] };
  }
};
