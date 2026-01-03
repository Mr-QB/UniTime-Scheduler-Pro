
export interface CourseData {
  stt: string | number;
  courseCode: string; // Mã học phần
  courseName: string; // Tên học phần
  credits: number | string; // Số tín chỉ
  sectionCode: string; // Mã lớp học phần
  lecturer: string; // Giảng viên
  studentCount: number; // Số sinh viên
  registeredCount: number; // Số đăng ký
  dayOfWeek: string | number; // Thứ
  period: string; // Tiết
  room: string; // Giảng đường
  duration: string | number; // Thời lượng
  // Trạng thái xử lý
  isError?: boolean;
  errorMessage?: string;
  suggestedRoom?: string; // Phòng gợi ý từ AI
  validationStatus?: 'verified' | 'violated' | 'original_violated' | 'unchecked'; // Trạng thái xác minh
  validationError?: string; // Lỗi cụ thể nếu code phát hiện
}

export interface RoomData {
  stt: string | number;
  roomName: string; // Phòng
  capacity: number; // Số lượng chỗ ngồi tối đa (SL)
}
