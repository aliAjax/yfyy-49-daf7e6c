import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import db, { initDatabase } from '../database';
import { generateToken } from '../middleware/auth';

export const fixtures = {
  departments: {
    police: 'dept-police',
    market: 'dept-market',
  },
  windows: {
    police: 'window-police',
    market: 'window-market',
  },
  services: {
    idCard: 'service-id-card',
    license: 'service-license',
  },
  users: {
    citizen: 'user-citizen',
    otherCitizen: 'user-other-citizen',
    admin: 'user-admin',
    policeWindow: 'user-police-window',
    marketWindow: 'user-market-window',
  },
};

export function resetDatabase() {
  initDatabase();
  db.exec(`
    DELETE FROM operation_logs;
    DELETE FROM notifications;
    DELETE FROM evaluations;
    DELETE FROM case_flows;
    DELETE FROM case_materials;
    DELETE FROM cases;
    DELETE FROM tickets;
    DELETE FROM appointments;
    DELETE FROM number_sources;
    DELETE FROM service_items;
    DELETE FROM windows;
    DELETE FROM users;
    DELETE FROM departments;
  `);
  seedBaseData();
}

export function authHeader(userId: string) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  return { Authorization: `Bearer ${generateToken(user)}` };
}

export function futureDate(offset = 1) {
  return dayjs().add(offset, 'day').format('YYYY-MM-DD');
}

export function createAppointment(options: {
  id?: string;
  userId?: string;
  serviceItemId?: string;
  status?: string;
  appointmentDate?: string;
  applicantName?: string;
}) {
  const id = options.id || uuidv4();
  db.prepare(`
    INSERT INTO appointments (
      id, user_id, service_item_id, appointment_date, time_slot, status,
      applicant_name, applicant_phone, applicant_id_card, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    options.userId || fixtures.users.citizen,
    options.serviceItemId || fixtures.services.idCard,
    options.appointmentDate || futureDate(),
    '09:00-10:00',
    options.status || 'confirmed',
    options.applicantName || '测试群众',
    '13800000000',
    '110101199001010000',
    null
  );
  return id;
}

export function getTicketByAppointment(appointmentId: string) {
  return db.prepare('SELECT * FROM tickets WHERE appointment_id = ?').get(appointmentId) as any;
}

function seedBaseData() {
  db.prepare('INSERT INTO departments (id, name, code) VALUES (?, ?, ?)').run(
    fixtures.departments.police,
    '公安局',
    'GA'
  );
  db.prepare('INSERT INTO departments (id, name, code) VALUES (?, ?, ?)').run(
    fixtures.departments.market,
    '市场监管局',
    'SC'
  );

  db.prepare('INSERT INTO windows (id, name, number, department_id) VALUES (?, ?, ?, ?)').run(
    fixtures.windows.police,
    '公安窗口',
    'A01',
    fixtures.departments.police
  );
  db.prepare('INSERT INTO windows (id, name, number, department_id) VALUES (?, ?, ?, ?)').run(
    fixtures.windows.market,
    '市场窗口',
    'B01',
    fixtures.departments.market
  );

  db.prepare(`
    INSERT INTO service_items (id, name, code, department_id, window_id, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(fixtures.services.idCard, '身份证办理', 'SFZ', fixtures.departments.police, fixtures.windows.police);
  db.prepare(`
    INSERT INTO service_items (id, name, code, department_id, window_id, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(fixtures.services.license, '营业执照办理', 'YYZZ', fixtures.departments.market, fixtures.windows.market);

  insertUser(fixtures.users.citizen, 'citizen', '群众一', 'citizen', null);
  insertUser(fixtures.users.otherCitizen, 'other_citizen', '群众二', 'citizen', null);
  insertUser(fixtures.users.admin, 'admin', '管理员', 'admin', null);
  insertUser(fixtures.users.policeWindow, 'police_window', '公安窗口员', 'window', fixtures.departments.police);
  insertUser(fixtures.users.marketWindow, 'market_window', '市场窗口员', 'window', fixtures.departments.market);

  for (let index = 0; index < 14; index += 1) {
    const date = futureDate(index);
    insertNumberSource(fixtures.services.idCard, date);
    insertNumberSource(fixtures.services.license, date);
  }
}

function insertUser(id: string, username: string, name: string, role: string, departmentId: string | null) {
  db.prepare(`
    INSERT INTO users (id, username, password, name, phone, role, department_id, status)
    VALUES (?, ?, 'test-password', ?, ?, ?, ?, 'active')
  `).run(id, username, name, '13800000000', role, departmentId);
}

function insertNumberSource(serviceItemId: string, date: string) {
  db.prepare(`
    INSERT INTO number_sources (id, service_item_id, date, total_count, booked_count)
    VALUES (?, ?, ?, 20, 0)
  `).run(uuidv4(), serviceItemId, date);
}
