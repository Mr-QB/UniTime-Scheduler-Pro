
import { CourseData, RoomData } from "../types";

// Chuẩn hóa "Thứ 2" -> "2", "Chủ nhật" -> "8"
export const normalizeDay = (day: string | number): string => {
  const d = String(day).toLowerCase();
  if (d.includes('chủ nhật') || d.includes('cn')) return '8';
  const match = d.match(/\d+/);
  return match ? match[0] : d;
};

// Lấy tiết bắt đầu: "1-3" -> "1", "1,2,3" -> "1", "Tiết 4" -> "4"
export const getStartPeriod = (period: string | number): string => {
  const p = String(period).toLowerCase();
  const match = p.match(/\d+/);
  if (!match) return p;
  const num = parseInt(match[0]);
  // Map về các mốc chuẩn: 1, 4, 7, 10
  if (num <= 3) return "1";
  if (num <= 6) return "4";
  if (num <= 9) return "7";
  return "10";
};

export const validateAISuggestions = (
  courses: CourseData[], 
  rooms: RoomData[]
): CourseData[] => {
  const roomMap = new Map<string, RoomData>();
  rooms.forEach(r => roomMap.set(r.roomName.trim().toLowerCase(), r));

  const occupancyMap = new Map<string, CourseData[]>();
  
  // Ghi nhận occupancy để check xung đột
  courses.forEach(c => {
    const rName = (c.suggestedRoom || c.room || "").trim().toLowerCase();
    if (rName && rName !== "null" && rName !== "") {
      const day = normalizeDay(c.dayOfWeek);
      const startP = getStartPeriod(c.period);
      const key = `${rName}_${day}_${startP}`;
      if (!occupancyMap.has(key)) occupancyMap.set(key, []);
      occupancyMap.get(key)!.push(c);
    }
  });

  return courses.map(course => {
    const isAISuggestion = !!course.suggestedRoom;
    const targetRoomName = (course.suggestedRoom || course.room || "").trim();
    const targetRoomKey = targetRoomName.toLowerCase();
    
    if (!targetRoomName || targetRoomKey === "null" || targetRoomName === "") {
        return { ...course, validationStatus: 'unchecked', validationError: undefined };
    }

    if (!isAISuggestion) {
      return { ...course, validationStatus: 'verified', validationError: undefined };
    }

    const roomInfo = roomMap.get(targetRoomKey);
    if (!roomInfo) {
      return {
        ...course,
        validationStatus: 'violated',
        validationError: `Phòng '${targetRoomName}' không tồn tại.`
      };
    }

    if (Number(course.registeredCount) > roomInfo.capacity) {
      return {
        ...course,
        validationStatus: 'violated',
        validationError: `Quá tải: ${course.registeredCount} > ${roomInfo.capacity} chỗ.`
      };
    }

    const day = normalizeDay(course.dayOfWeek);
    const startP = getStartPeriod(course.period);
    const key = `${targetRoomKey}_${day}_${startP}`;
    const others = occupancyMap.get(key) || [];
    
    let conflictWith = "";
    const hasConflict = others.some(other => {
      if (other.stt === course.stt) return false;
      const cNote = String(course.duration || "").toLowerCase();
      const oNote = String(other.duration || "").toLowerCase();
      const isAlternating = 
        (cNote.includes('7tuandau') && oNote.includes('7tuansau')) ||
        (cNote.includes('7tuansau') && oNote.includes('7tuandau'));
      
      if (!isAlternating) {
        conflictWith = `STT ${other.stt} (${other.sectionCode})`;
        return true;
      }
      return false;
    });

    if (hasConflict) {
      return {
        ...course,
        validationStatus: 'violated',
        validationError: `Trùng lịch với ${conflictWith}.`
      };
    }

    return { ...course, validationStatus: 'verified', validationError: undefined };
  });
};
