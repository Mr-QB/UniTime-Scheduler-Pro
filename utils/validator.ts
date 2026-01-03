
import { CourseData, RoomData } from "../types";

export const validateAISuggestions = (
  courses: CourseData[], 
  rooms: RoomData[]
): CourseData[] => {
  return courses.map(course => {
    const isAISuggestion = !!course.suggestedRoom;
    const targetRoomName = course.suggestedRoom || course.room;
    
    // Nếu không có phòng gán và cũng không có gợi ý -> Không kiểm tra
    if (!targetRoomName || targetRoomName.trim() === "" || targetRoomName.toLowerCase() === "null") {
        return { ...course, validationStatus: 'unchecked' };
    }

    const roomInfo = rooms.find(r => r.roomName.trim().toLowerCase() === targetRoomName.trim().toLowerCase());

    // 1. Trường hợp PHÒNG KHÔNG CÓ TRONG DANH SÁCH MASTER
    if (!roomInfo) {
      if (isAISuggestion) {
         return {
            ...course,
            validationStatus: 'violated',
            validationError: `AI gợi ý sai: Phòng '${targetRoomName}' không tồn tại trong danh sách Master.`
          };
      }
      return { 
        ...course, 
        validationStatus: 'unchecked', 
        validationError: `Ghi chú: Phòng này không nằm trong danh sách quản lý.` 
      };
    }

    // 2. Kiểm tra sức chứa (Dựa trên ĐK)
    if (course.registeredCount > roomInfo.capacity) {
      const errorMsg = `Quá tải: ${course.registeredCount} ĐK > ${roomInfo.capacity} chỗ (Phòng ${targetRoomName})`;
      return {
        ...course,
        validationStatus: isAISuggestion ? 'violated' : 'original_violated',
        validationError: errorMsg
      };
    }

    // 3. Kiểm tra xung đột chiếm dụng
    let conflictWithSTT = "";
    const isConflict = courses.some(other => {
      if (other.stt === course.stt) return false;
      
      const otherRoom = other.suggestedRoom || other.room;
      if (!otherRoom || otherRoom.trim().toLowerCase() !== targetRoomName.trim().toLowerCase()) return false;
      
      const sameDay = String(other.dayOfWeek).trim() === String(course.dayOfWeek).trim();
      const samePeriod = String(other.period).trim() === String(course.period).trim();
      
      if (!sameDay || !samePeriod) return false;

      const cNote = String(course.duration).toLowerCase();
      const oNote = String(other.duration).toLowerCase();
      const isWeekAlternating = 
        (cNote.includes('7tuandau') && oNote.includes('7tuansau')) ||
        (cNote.includes('7tuansau') && oNote.includes('7tuandau'));

      if (!isWeekAlternating) {
        conflictWithSTT = String(other.stt);
        return true;
      }
      return false;
    });

    if (isConflict) {
      const errorMsg = `Trùng lịch: Phòng ${targetRoomName} đã bị STT ${conflictWithSTT} chiếm dụng.`;
      return {
        ...course,
        validationStatus: isAISuggestion ? 'violated' : 'original_violated',
        validationError: errorMsg
      };
    }

    // 4. Kết luận trạng thái nếu không có lỗi
    if (isAISuggestion) {
      return {
        ...course,
        validationStatus: 'verified'
      };
    }

    return { ...course, validationStatus: 'unchecked' };
  });
};
