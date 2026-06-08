import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db, { initDatabase } from './database';
import dayjs from 'dayjs';

function seed() {
  initDatabase();
  console.log('开始初始化种子数据...\n');

  const hashedPassword = bcrypt.hashSync('123456', 10);

  console.log('1. 创建科室...');
  const depts = [
    { id: uuidv4(), name: '综合窗口', code: 'ZH', desc: '综合服务科室' },
    { id: uuidv4(), name: '市场监管局', code: 'SCJG', desc: '市场监督管理局' },
    { id: uuidv4(), name: '公安局', code: 'GA', desc: '公安局出入境、户政' },
    { id: uuidv4(), name: '税务局', code: 'SW', desc: '税务局' },
    { id: uuidv4(), name: '住建局', code: 'ZJJ', desc: '住房和城乡建设局' },
    { id: uuidv4(), name: '人社局', code: 'RSJ', desc: '人力资源和社会保障局' },
  ];

  const deptStmt = db.prepare(
    'INSERT OR IGNORE INTO departments (id, name, code, description) VALUES (?, ?, ?, ?)'
  );
  depts.forEach(d => deptStmt.run(d.id, d.name, d.code, d.desc));
  console.log(`   已创建 ${depts.length} 个科室\n`);

  console.log('2. 创建用户...');
  const users = [
    { id: uuidv4(), username: 'admin', name: '系统管理员', role: 'admin', deptId: null, idCard: null, phone: null },
    { id: uuidv4(), username: 'window01', name: '张窗口', role: 'window', deptId: depts[0].id, idCard: null, phone: '13900000001' },
    { id: uuidv4(), username: 'window02', name: '李窗口', role: 'window', deptId: depts[0].id, idCard: null, phone: '13900000002' },
    { id: uuidv4(), username: 'approver01', name: '王审批', role: 'approver', deptId: depts[1].id, idCard: null, phone: '13900000003' },
    { id: uuidv4(), username: 'approver02', name: '赵审批', role: 'approver', deptId: depts[2].id, idCard: null, phone: '13900000004' },
    { id: uuidv4(), username: 'approver03', name: '钱审批', role: 'approver', deptId: depts[3].id, idCard: null, phone: '13900000005' },
    { id: uuidv4(), username: 'citizen01', name: '张三', role: 'citizen', deptId: null, idCard: '110101199001011234', phone: '13800138001' },
    { id: uuidv4(), username: 'citizen02', name: '李四', role: 'citizen', deptId: null, idCard: '110101199202022345', phone: '13800138002' },
  ];

  const userStmt = db.prepare(
    'INSERT OR IGNORE INTO users (id, username, password, name, role, department_id, id_card, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  users.forEach(u => userStmt.run(u.id, u.username, hashedPassword, u.name, u.role, u.deptId, u.idCard, u.phone, 'active'));
  console.log(`   已创建 ${users.length} 个用户`);
  console.log('   测试账号: admin / window01 / approver01 / citizen01');
  console.log('   密码均为: 123456\n');

  console.log('3. 创建窗口...');
  const windows = [
    { id: uuidv4(), name: '综合窗口', number: '01', deptId: depts[0].id, type: 'comprehensive' },
    { id: uuidv4(), name: '市场监管窗口', number: '02', deptId: depts[1].id, type: 'specialized' },
    { id: uuidv4(), name: '公安窗口', number: '03', deptId: depts[2].id, type: 'specialized' },
    { id: uuidv4(), name: '税务窗口', number: '04', deptId: depts[3].id, type: 'specialized' },
    { id: uuidv4(), name: '住建窗口', number: '05', deptId: depts[4].id, type: 'specialized' },
    { id: uuidv4(), name: '人社窗口', number: '06', deptId: depts[5].id, type: 'specialized' },
  ];

  const windowStmt = db.prepare(
    'INSERT OR IGNORE INTO windows (id, name, number, department_id, status, type) VALUES (?, ?, ?, ?, ?, ?)'
  );
  windows.forEach(w => windowStmt.run(w.id, w.name, w.number, w.deptId, 'open', w.type));
  console.log(`   已创建 ${windows.length} 个窗口\n`);

  console.log('4. 创建服务事项...');
  const serviceItems = [
    {
      id: uuidv4(), name: '营业执照办理', code: 'YYZZ',
      deptId: depts[1].id, windowId: windows[1].id,
      desc: '个体工商户、企业营业执照的新办、变更、注销等业务',
      materials: JSON.stringify([
        { name: '身份证', required: true },
        { name: '经营场所证明', required: true },
        { name: '申请表', required: true },
        { name: '一寸照片', required: false }
      ]),
      processing_time: 5, fee: 0, sort_order: 1
    },
    {
      id: uuidv4(), name: '食品经营许可证', code: 'SPJY',
      deptId: depts[1].id, windowId: windows[1].id,
      desc: '食品经营许可证的申请、变更、延续、注销',
      materials: JSON.stringify([
        { name: '营业执照', required: true },
        { name: '经营场所布局图', required: true },
        { name: '健康证', required: true },
        { name: '食品安全管理制度', required: true }
      ]),
      processing_time: 10, fee: 0, sort_order: 2
    },
    {
      id: uuidv4(), name: '身份证办理', code: 'SFZ',
      deptId: depts[2].id, windowId: windows[2].id,
      desc: '居民身份证的首次申领、换领、补领',
      materials: JSON.stringify([
        { name: '户口本', required: true },
        { name: '旧身份证（换领）', required: false }
      ]),
      processing_time: 20, fee: 20, sort_order: 3
    },
    {
      id: uuidv4(), name: '护照办理', code: 'HZ',
      deptId: depts[2].id, windowId: windows[2].id,
      desc: '普通护照的首次申请、换发、补发',
      materials: JSON.stringify([
        { name: '身份证', required: true },
        { name: '照片', required: true },
        { name: '申请表', required: true }
      ]),
      processing_time: 7, fee: 120, sort_order: 4
    },
    {
      id: uuidv4(), name: '社保登记', code: 'SBDJ',
      deptId: depts[5].id, windowId: windows[5].id,
      desc: '社会保险参保登记、变更、注销',
      materials: JSON.stringify([
        { name: '身份证', required: true },
        { name: '户口本', required: true },
        { name: '一寸照片', required: true }
      ]),
      processing_time: 3, fee: 0, sort_order: 5
    },
    {
      id: uuidv4(), name: '不动产权证办理', code: 'BDCQZ',
      deptId: depts[4].id, windowId: windows[4].id,
      desc: '不动产权证书的办理、变更、转移',
      materials: JSON.stringify([
        { name: '身份证', required: true },
        { name: '购房合同', required: true },
        { name: '完税证明', required: true },
        { name: '房屋平面图', required: true }
      ]),
      processing_time: 15, fee: 80, sort_order: 6
    },
    {
      id: uuidv4(), name: '税务登记', code: 'SWDJ',
      deptId: depts[3].id, windowId: windows[3].id,
      desc: '税务开业登记、变更、注销',
      materials: JSON.stringify([
        { name: '营业执照', required: true },
        { name: '身份证', required: true },
        { name: '公司章程', required: false }
      ]),
      processing_time: 1, fee: 0, sort_order: 7
    },
    {
      id: uuidv4(), name: '个体工商户注销', code: 'GTGSZX',
      deptId: depts[1].id, windowId: windows[1].id,
      desc: '个体工商户注销登记',
      materials: JSON.stringify([
        { name: '营业执照正副本', required: true },
        { name: '身份证', required: true },
        { name: '公章', required: false }
      ]),
      processing_time: 3, fee: 0, sort_order: 8
    },
  ];

  const itemStmt = db.prepare(`
    INSERT OR IGNORE INTO service_items 
    (id, name, code, department_id, window_id, description, materials, processing_time, fee, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  serviceItems.forEach(item => {
    itemStmt.run(item.id, item.name, item.code, item.deptId, item.windowId, 
      item.desc, item.materials, item.processing_time, item.fee, item.sort_order);
  });
  console.log(`   已创建 ${serviceItems.length} 个服务事项\n`);

  console.log('5. 生成号源（未来14天）...');
  const sourceStmt = db.prepare(`
    INSERT OR IGNORE INTO number_sources (id, service_item_id, date, total_count, booked_count, time_slots)
    VALUES (?, ?, ?, ?, 0, ?)
  `);

  const timeSlots = JSON.stringify([
    '09:00-09:30', '09:30-10:00', '10:00-10:30', '10:30-11:00',
    '11:00-11:30', '14:00-14:30', '14:30-15:00', '15:00-15:30',
    '15:30-16:00', '16:00-16:30', '16:30-17:00'
  ]);

  let sourceCount = 0;
  for (let i = 0; i < 14; i++) {
    const date = dayjs().add(i, 'day').format('YYYY-MM-DD');
    serviceItems.forEach(item => {
      const id = uuidv4();
      const result = sourceStmt.run(id, item.id, date, 20, timeSlots);
      if (result.changes > 0) sourceCount++;
    });
  }
  console.log(`   已生成 ${sourceCount} 条号源记录\n`);

  console.log('6. 创建示例办件...');
  const caseStmt = db.prepare(`
    INSERT OR IGNORE INTO cases 
    (id, case_number, service_item_id, user_id, department_id, status, applicant_name, applicant_phone, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleCases = [
    {
      id: uuidv4(),
      caseNumber: 'YYZZ' + dayjs().format('YYYYMMDD') + '0001',
      serviceItemId: serviceItems[0].id,
      userId: users[6].id,
      deptId: depts[1].id,
      status: 'reviewing',
      applicantName: '张三',
      applicantPhone: '13800138001',
      deadline: dayjs().add(3, 'day').format('YYYY-MM-DD HH:mm:ss')
    },
    {
      id: uuidv4(),
      caseNumber: 'SFZ' + dayjs().format('YYYYMMDD') + '0001',
      serviceItemId: serviceItems[2].id,
      userId: users[7].id,
      deptId: depts[2].id,
      status: 'completed',
      applicantName: '李四',
      applicantPhone: '13800138002',
      deadline: dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss')
    },
    {
      id: uuidv4(),
      caseNumber: 'SPJY' + dayjs().format('YYYYMMDD') + '0001',
      serviceItemId: serviceItems[1].id,
      userId: users[6].id,
      deptId: depts[1].id,
      status: 'material_correction',
      applicantName: '张三',
      applicantPhone: '13800138001',
      deadline: dayjs().add(7, 'day').format('YYYY-MM-DD HH:mm:ss')
    },
  ];

  sampleCases.forEach(c => {
    caseStmt.run(c.id, c.caseNumber, c.serviceItemId, c.userId, c.deptId,
      c.status, c.applicantName, c.applicantPhone, c.deadline);
  });
  console.log(`   已创建 ${sampleCases.length} 个示例办件\n`);

  console.log('7. 创建示例评价...');
  const evalStmt = db.prepare(`
    INSERT OR IGNORE INTO evaluations 
    (id, case_id, user_id, overall_rating, service_attitude_rating, processing_speed_rating, 
     material_requirement_rating, comment, is_satisfied)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  evalStmt.run(
    uuidv4(), sampleCases[1].id, users[7].id, 5, 5, 4, 5,
    '办理速度很快，工作人员态度很好，非常满意！', 1
  );
  console.log('   已创建 1 条示例评价\n');

  console.log('✅ 种子数据初始化完成！');
  console.log('\n📋 默认账号列表：');
  console.log('   管理员  - admin / 123456');
  console.log('   窗口员  - window01 / 123456');
  console.log('   审批员  - approver01 / 123456');
  console.log('   群众    - citizen01 / 123456');
}

seed();
