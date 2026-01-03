import { CourseData, RoomData } from "../types";

interface ScheduleResult {
  suggestions: { stt: string | number; room: string }[];
  report: string;
}

// Normalize day "Thứ 2" -> "2", "Chủ nhật" -> "8"
const normalizeDay = (day: string | number): string => {
  const d = String(day).toLowerCase();
  if (d.includes('chủ nhật') || d.includes('cn')) return '8';
  const match = d.match(/\d+/);
  return match ? match[0] : d;
};

// Get start period: "1-3" -> "1", "4-6" -> "4", etc.
const getStartPeriod = (period: string | number): string => {
  const p = String(period).toLowerCase();
  const match = p.match(/\d+/);
  if (!match) return p;
  const num = parseInt(match[0]);
  if (num <= 3) return "1";
  if (num <= 6) return "4";
  if (num <= 9) return "7";
  return "10";
};

// Get slot key for conflict detection
const getSlotKey = (day: string | number, period: string | number): string => {
  return `${normalizeDay(day)}_${getStartPeriod(period)}`;
};

// Check if this course is 7tuandau or 7tuansau
const isAlternatingWeek = (duration: string): '7tuandau' | '7tuansau' | 'full' => {
  const d = String(duration || "").toLowerCase();
  if (d.includes('7tuandau')) return '7tuandau';
  if (d.includes('7tuansau')) return '7tuansau';
  return 'full';
};

// Check if another course with same slot is 7tuandau/7tuansau pair
const canShareSlot = (course1: CourseData, course2: CourseData, slotKey: string): boolean => {
  // If same course code, can share if one is 7tuandau and other is 7tuansau
  if (course1.courseCode === course2.courseCode && getSlotKey(course2.dayOfWeek, course2.period) === slotKey) {
    const type1 = isAlternatingWeek(course1.duration);
    const type2 = isAlternatingWeek(course2.duration);
    // Can share if one is 7tuandau and other is 7tuansau
    return (type1 === '7tuandau' && type2 === '7tuansau') || (type1 === '7tuansau' && type2 === '7tuandau');
  }
  return false;
};

export const scheduleWithHardcodedLogic = (
  courses: CourseData[],
  rooms: RoomData[]
): ScheduleResult => {
  console.log('🔧 HARDCODED LOGIC RUNNING - NOT AI!');
  const suggestions: { stt: string | number; room: string }[] = [];
  let assigned = 0;
  let skipped = 0;

  // Separate courses into two groups:
  // 1. Already assigned (có phòng trong Excel ban đầu) - KHÓA, KHÔNG ĐƯỢC THAY ĐỔI
  // 2. Unassigned (chưa có phòng) - XẾP LẠI
  const assignedCourses = courses.filter(c => 
    c.room && c.room.toLowerCase() !== 'null' && c.room.trim() !== ''
  );
  
  const unassignedCourses = courses.filter(c => 
    !c.room || c.room.toLowerCase() === 'null' || c.room.trim() === ''
  );

  if (unassignedCourses.length === 0) {
    return { 
      suggestions: [], 
      report: `Hoàn tất - tất cả lớp đã xếp phòng (${assignedCourses.length} lớp được khóa)` 
    };
  }

  // Build occupancy map from FIXED courses (đã xếp trong Excel)
  // Những slot này KHÔNG ĐƯỢC PHÉP XẾP LẠI
  const occupancyMap = new Map<string, Set<string>>();
  assignedCourses.forEach(c => {
    const assignedRoom = (c.room || "").trim().toLowerCase();
    if (assignedRoom && assignedRoom !== "null" && assignedRoom !== "") {
      if (!occupancyMap.has(assignedRoom)) {
        occupancyMap.set(assignedRoom, new Set());
      }
      const slotKey = getSlotKey(c.dayOfWeek, c.period);
      occupancyMap.get(assignedRoom)!.add(slotKey);
      console.log(`🔒 Khóa lớp: ${c.sectionCode || c.stt} tại ${assignedRoom} (${slotKey})`);
    }
  });

  // Group unassigned courses by course code (mã LHP)
  const coursesByCode = new Map<string, CourseData[]>();
  unassignedCourses.forEach(c => {
    const code = c.courseCode || c.sectionCode || String(c.stt);
    if (!coursesByCode.has(code)) {
      coursesByCode.set(code, []);
    }
    coursesByCode.get(code)!.push(c);
  });

  // Track assigned courses (for conflict detection)
  const assignedCoursesMap = new Map<string, CourseData[]>(); // roomKey -> courses[]
  assignedCourses.forEach(c => {
    const roomKey = (c.room || "").trim().toLowerCase();
    if (roomKey && roomKey !== "null") {
      if (!assignedCoursesMap.has(roomKey)) {
        assignedCoursesMap.set(roomKey, []);
      }
      assignedCoursesMap.get(roomKey)!.push(c);
    }
  });

  // Sort all rooms by capacity (ascending) to find smallest fitting room
  const sortedRooms = [...rooms].sort((a, b) => a.capacity - b.capacity);

  // Process each course group
  coursesByCode.forEach((coursesInGroup, courseCode) => {
    // Sort by registered count (descending) to assign largest first
    const sorted = [...coursesInGroup].sort(
      (a, b) => (Number(b.registeredCount) || 0) - (Number(a.registeredCount) || 0)
    );

    let preferredRoom: string | null = null;

    for (const course of sorted) {
      const studentCount = Number(course.registeredCount) || 0;
      const slotKey = getSlotKey(course.dayOfWeek, course.period);

      // If same course code, try to use same room first
      if (preferredRoom) {
        const room = rooms.find(r => r.roomName.toLowerCase() === preferredRoom);
        if (room && room.capacity >= studentCount) {
          const roomOccupancy = occupancyMap.get(preferredRoom) || new Set();

          // Check if can share slot with existing courses (7tuandau + 7tuansau pair)
          let canAssign = !roomOccupancy.has(slotKey);
          if (!canAssign) {
            // Check if existing course in this slot is a 7tuandau/7tuansau pair
            const existingFixed = assignedCoursesMap.get(preferredRoom) || [];
            const existingInSlot = existingFixed.filter(c => getSlotKey(c.dayOfWeek, c.period) === slotKey);
            
            // Also check suggestions already made
            const suggestedInSlot = suggestions
              .filter(s => s.room && s.room.toLowerCase() === preferredRoom)
              .map(s => courses.find(c => c.stt === s.stt))
              .filter((c): c is CourseData => c !== undefined && getSlotKey(c.dayOfWeek, c.period) === slotKey);
            
            const allExisting = [...existingInSlot, ...suggestedInSlot];
            
            // Can share only if: same courseCode AND one is 7tuandau and other is 7tuansau
            canAssign = allExisting.length > 0 && allExisting.every(existing => 
              course.courseCode === existing.courseCode &&
              canShareSlot(course, existing, slotKey)
            );
          }

          if (canAssign) {
            suggestions.push({ stt: course.stt, room: room.roomName });
            roomOccupancy.add(slotKey);
            occupancyMap.set(preferredRoom, roomOccupancy);
            assigned++;
            continue;
          }
        }
      }

      // Find smallest room that can fit this course
      let assigned_this = false;
      for (const room of sortedRooms) {
        // Skip if room capacity is too small
        if (room.capacity < studentCount) continue;

        const roomKey = room.roomName.toLowerCase();
        const roomOccupancy = occupancyMap.get(roomKey) || new Set();

        // Check if can assign to this slot
        let canAssign = !roomOccupancy.has(slotKey);
        if (!canAssign) {
          // Check if existing courses in this slot can share with current course
          const existingFixed = assignedCoursesMap.get(roomKey) || [];
          const existingInSlot = existingFixed.filter(c => getSlotKey(c.dayOfWeek, c.period) === slotKey);
          
          // Also check suggestions already made
          const suggestedInSlot = suggestions
            .filter(s => s.room && s.room.toLowerCase() === roomKey)
            .map(s => courses.find(c => c.stt === s.stt))
            .filter((c): c is CourseData => c !== undefined && getSlotKey(c.dayOfWeek, c.period) === slotKey);
          
          const allExisting = [...existingInSlot, ...suggestedInSlot];
          
          // Can share only if: same courseCode AND one is 7tuandau and other is 7tuansau
          canAssign = allExisting.length > 0 && allExisting.every(existing => 
            course.courseCode === existing.courseCode &&
            canShareSlot(course, existing, slotKey)
          );
        }

        // Assign to this room if available
        if (canAssign) {
          suggestions.push({ stt: course.stt, room: room.roomName });
          roomOccupancy.add(slotKey);
          occupancyMap.set(roomKey, roomOccupancy);
          
          // Remember this room for same course code
          if (!preferredRoom) {
            preferredRoom = roomKey;
          }
          
          assigned++;
          assigned_this = true;
          break; // Found smallest fitting room, stop searching
        }
      }

      if (!assigned_this) {
        skipped++;
      }
    }
  });

  const report = `Xếp được: ${assigned}/${unassignedCourses.length} lớp. (Không tìm phòng phù hợp: ${skipped})`;
  return { suggestions, report };
};
