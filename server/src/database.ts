import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'gov-service.db');
const db = new Database(dbPath) as any;

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      id_card TEXT,
      phone TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'citizen',
      department_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS windows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      number TEXT NOT NULL,
      department_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      type TEXT NOT NULL DEFAULT 'comprehensive',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS service_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      department_id TEXT,
      window_id TEXT,
      description TEXT,
      materials TEXT,
      processing_time INTEGER,
      fee REAL,
      status TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (window_id) REFERENCES windows(id)
    );

    CREATE TABLE IF NOT EXISTS number_sources (
      id TEXT PRIMARY KEY,
      service_item_id TEXT NOT NULL,
      date TEXT NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      booked_count INTEGER NOT NULL DEFAULT 0,
      time_slots TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_item_id) REFERENCES service_items(id),
      UNIQUE(service_item_id, date)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service_item_id TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      time_slot TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      applicant_name TEXT,
      applicant_phone TEXT,
      applicant_id_card TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (service_item_id) REFERENCES service_items(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      ticket_number TEXT NOT NULL,
      service_item_id TEXT NOT NULL,
      window_id TEXT,
      user_id TEXT,
      appointment_id TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      applicant_name TEXT,
      applicant_phone TEXT,
      call_count INTEGER DEFAULT 0,
      called_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_item_id) REFERENCES service_items(id),
      FOREIGN KEY (window_id) REFERENCES windows(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_number TEXT NOT NULL UNIQUE,
      service_item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ticket_id TEXT,
      window_id TEXT,
      department_id TEXT,
      current_handler_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      priority TEXT DEFAULT 'normal',
      applicant_name TEXT,
      applicant_phone TEXT,
      applicant_id_card TEXT,
      application_data TEXT,
      materials TEXT,
      deadline DATETIME,
      completed_at DATETIME,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_item_id) REFERENCES service_items(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (window_id) REFERENCES windows(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (current_handler_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS case_materials (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      file_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      review_comment TEXT,
      reviewed_by TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id)
    );

    CREATE TABLE IF NOT EXISTS case_flows (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      from_department_id TEXT,
      to_department_id TEXT,
      from_user_id TEXT,
      to_user_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      deadline DATETIME,
      handled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id),
      FOREIGN KEY (from_department_id) REFERENCES departments(id),
      FOREIGN KEY (to_department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      overall_rating INTEGER NOT NULL,
      service_attitude_rating INTEGER,
      processing_speed_rating INTEGER,
      material_requirement_rating INTEGER,
      comment TEXT,
      suggestions TEXT,
      is_satisfied INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      is_read INTEGER DEFAULT 0,
      related_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT,
      detail TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_item_materials (
      id TEXT PRIMARY KEY,
      service_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      example TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_item_id) REFERENCES service_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service_item_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (service_item_id) REFERENCES service_items(id) ON DELETE CASCADE,
      UNIQUE(user_id, service_item_id)
    );
  `);

  console.log('数据库初始化完成');
}

export default db;
