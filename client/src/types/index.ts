export type UserRole = 'admin' | 'window' | 'approver' | 'citizen';

export type CaseStatus =
  | 'draft'
  | 'submitted'
  | 'material_reviewing'
  | 'material_correction'
  | 'accepting'
  | 'reviewing'
  | 'cross_department'
  | 'approved'
  | 'rejected'
  | 'completed';

export type TicketStatus = 'waiting' | 'calling' | 'processing' | 'completed' | 'cancelled';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface User {
  id: string;
  username: string;
  name: string;
  id_card?: string;
  phone?: string;
  email?: string;
  role: UserRole;
  department_id?: string;
  status: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Window {
  id: string;
  name: string;
  number: string;
  department_id?: string;
  department_name?: string;
  status: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  code: string;
  department_id?: string;
  department_name?: string;
  window_id?: string;
  window_name?: string;
  description?: string;
  materials?: string;
  processing_time?: number;
  fee?: number;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  service_item_id: string;
  service_item_name?: string;
  service_item_code?: string;
  department_name?: string;
  appointment_date: string;
  time_slot?: string;
  status: AppointmentStatus;
  applicant_name?: string;
  applicant_phone?: string;
  applicant_id_card?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  service_item_id: string;
  service_item_name?: string;
  service_item_code?: string;
  window_id?: string;
  window_name?: string;
  window_number?: string;
  user_id?: string;
  appointment_id?: string;
  status: TicketStatus;
  applicant_name?: string;
  applicant_phone?: string;
  call_count: number;
  called_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  service_item_id: string;
  service_item_name?: string;
  service_item_code?: string;
  service_item_description?: string;
  required_materials?: string;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  ticket_id?: string;
  window_id?: string;
  window_name?: string;
  department_id?: string;
  department_name?: string;
  current_handler_id?: string;
  handler_name?: string;
  status: CaseStatus;
  priority: string;
  applicant_name?: string;
  applicant_phone?: string;
  applicant_id_card?: string;
  application_data?: string;
  materials?: string;
  deadline?: string;
  completed_at?: string;
  result?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseMaterial {
  id: string;
  case_id: string;
  name: string;
  type?: string;
  file_url?: string;
  status: string;
  review_comment?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseFlow {
  id: string;
  case_id: string;
  from_department_id?: string;
  from_department_name?: string;
  to_department_id?: string;
  to_department_name?: string;
  from_user_id?: string;
  from_user_name?: string;
  to_user_id?: string;
  to_user_name?: string;
  action: string;
  status: string;
  comment?: string;
  deadline?: string;
  handled_at?: string;
  created_at: string;
}

export interface Evaluation {
  id: string;
  case_id: string;
  case_number?: string;
  service_item_name?: string;
  department_name?: string;
  user_id: string;
  user_name?: string;
  overall_rating: number;
  service_attitude_rating?: number;
  processing_speed_rating?: number;
  material_requirement_rating?: number;
  comment?: string;
  suggestions?: string;
  is_satisfied: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content?: string;
  is_read: number;
  related_id?: string;
  created_at: string;
}

export interface NumberSource {
  id: string;
  service_item_id: string;
  date: string;
  total_count: number;
  booked_count: number;
  time_slots?: string;
  created_at: string;
  updated_at: string;
}

export const CaseStatusText: Record<CaseStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  material_reviewing: '材料审核中',
  material_correction: '材料需补正',
  accepting: '受理中',
  reviewing: '审批中',
  cross_department: '跨科室流转中',
  approved: '审批通过',
  rejected: '审批驳回',
  completed: '已办结',
};

export const TicketStatusText: Record<TicketStatus, string> = {
  waiting: '等待中',
  calling: '已呼叫',
  processing: '办理中',
  completed: '已完成',
  cancelled: '已取消',
};

export const AppointmentStatusText: Record<AppointmentStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已取消',
  completed: '已完成',
};

export const RoleText: Record<UserRole, string> = {
  admin: '系统管理员',
  window: '窗口工作人员',
  approver: '审批人员',
  citizen: '办事群众',
};
