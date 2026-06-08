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
  password?: string;
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

export interface ServiceItem {
  id: string;
  name: string;
  code: string;
  department_id?: string;
  window_id?: string;
  description?: string;
  materials?: string;
  processing_time?: number;
  fee?: number;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceItemMaterial {
  id: string;
  service_item_id: string;
  name: string;
  is_required: number;
  description?: string;
  example?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  service_item_id: string;
  created_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  service_item_id: string;
  user_id: string;
  ticket_id?: string;
  window_id?: string;
  department_id?: string;
  current_handler_id?: string;
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
