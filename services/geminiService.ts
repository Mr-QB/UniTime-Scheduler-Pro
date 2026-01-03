
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
  iteration: number
): Promise<AIAnalysisResult> => {
  // QUAN TRỌNG: Tạo instance mới tại đây để lấy API_KEY mới nhất từ process.env
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const BATCH_SIZE = 80; 
  let targetCourses = [];
  
  if (mode === 'FILLING') {
    targetCourses = courses.filter(c => 
      (!c.room || c.room.toLowerCase() === 'null' || c.room.trim() === '') && 
      !c.suggestedRoom
    );
  } else {
    targetCourses = courses.filter(c => 
      c.suggestedRoom && c.validationStatus === 'violated'
    );
  }

  if (targetCourses.length === 0) return { report: "Hoàn tất", suggestions: [] };

  targetCourses.sort((a, b) => (Number(b.registeredCount) || 0) - (Number(a.registeredCount) || 0));
  const batch = targetCourses.slice(0, BATCH_SIZE);

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
    return freeSlots.length ? `${r.roomName}(${r.capacity})[${freeSlots.join('')}]` : null;
  }).filter(Boolean).join('|');

  const compressedTargets = batch.map(c => 
    `${c.stt}:${c.registeredCount}@${getSlotCode(c.dayOfWeek, c.period)}`
  ).join(' ');

  const prompt = `ACT AS: SCHEDULER. MODE: ${mode}. ROOMS: ${compressedRooms}. TARGETS: ${compressedTargets}. GOAL: Greedy. RES JSON: {"res":{"STT":"ROOM"}}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1024 }
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
