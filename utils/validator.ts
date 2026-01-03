
import { CourseData, RoomData } from "../types";

export const validateAISuggestions = (
  courses: CourseData[], 
  rooms: RoomData[]
): CourseData[] => {
  return courses.map(course => {
    const isAISuggestion = !!course.suggestedRoom;
    const targetRoomName = course.suggestedRoom || course.room;
    
    if (!targetRoomName || targetRoomName.trim() === "" || targetRoomName.toLowerCase() === "null") {
        return { ...course, validationStatus: 'unchecked' };
    }

    const roomInfo = rooms.find(r => r.roomName.trim().toLowerCase() === targetRoomName.trim().toLowerCase());

    if (!roomInfo) {
      return {
        ...course,
        validationStatus: isAISuggestion ? 'violated' : 'original_violated',
        validationError: `Phòng '${targetRoomName}' không tồn tại trong danh sách.`
      };
    }

    if (Number(course.registeredCount) > roomInfo.capacity) {
      return {
        ...course,
        validationStatus: isAISuggestion ? 'violated' : 'original_violated',
        validationError: `Quá tải: ${course.registeredCount} > ${roomInfo.capacity} chỗ.`
      };
    }

    // Kiểm tra xung đột thời gian
    let conflictWith = "";
    const isConflict = courses.some(other => {
      if (other.stt === course.stt) return false;
      
      const otherRoom = other.suggestedRoom || other.room;
      if (!otherRoom || otherRoom.trim().toLowerCase() !== targetRoomName.trim().toLowerCase()) return false;
      
      // So khớp Thứ và Tiết (Chuẩn hóa chuỗi để so sánh chính xác)
      const sameDay = String(other.dayOfWeek).trim() === String(course.dayOfWeek).trim();
      const samePeriod = String(other.period).trim() === String(course.period).trim();
      
      if (sameDay && samePeriod) {
        // Kiểm tra bù trừ tuần (7 tuần đầu / 7 tuần sau)
        const cNote = String(course.duration || "").toLowerCase();
        const oNote = String(other.duration || "").toLowerCase();
        const isAlternating = 
          (cNote.includes('7tuandau') && oNote.includes('7tuansau')) ||
          (cNote.includes('7tuansau') && oNote.includes('7tuandau'));
        
        if (!isAlternating) {
          conflictWith = `STT ${other.stt} (${other.sectionCode})`;
          return true;
        }
      }
      return false;
    });

    if (isConflict) {
      return {
        ...course,
        validationStatus: isAISuggestion ? 'violated' : 'original_violated',
        validationError: `Trùng lịch với ${conflictWith}.`
      };
    }

    return {
      ...course,
      validationStatus: 'verified',
      validationError: undefined
    };
  });
};
