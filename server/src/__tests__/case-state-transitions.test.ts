import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import caseRoutes from '../routes/case';
import { authHeader, fixtures, resetDatabase } from './helpers';
import type { CaseStatus } from '../types';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cases', caseRoutes);
  return app;
}

function createCase(options: {
  id?: string;
  status?: CaseStatus;
  userId?: string;
  departmentId?: string;
  ticketId?: string | null;
} = {}) {
  const id = options.id || uuidv4();
  db.prepare(`
    INSERT INTO cases (
      id, case_number, service_item_id, user_id, ticket_id, window_id,
      department_id, status, applicant_name, applicant_phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    `CASE-${id.slice(0, 8)}`,
    fixtures.services.idCard,
    options.userId || fixtures.users.citizen,
    options.ticketId || null,
    fixtures.windows.police,
    options.departmentId || fixtures.departments.police,
    options.status || 'submitted',
    '测试群众',
    '13800000000'
  );
  return id;
}

function createMaterial(caseId: string, options: { id?: string; status?: string; name?: string } = {}) {
  const id = options.id || uuidv4();
  db.prepare(`
    INSERT INTO case_materials (id, case_id, name, type, file_url, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, caseId, options.name || '身份证明', 'image', '/files/material.png', options.status || 'pending');
  return id;
}

function getCase(caseId: string) {
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as any;
}

function getFlows(caseId: string) {
  return db.prepare('SELECT * FROM case_flows WHERE case_id = ? ORDER BY created_at ASC').all(caseId) as any[];
}

describe('case state transition routes', () => {
  const app = createApp();

  beforeEach(() => {
    resetDatabase();
  });

  test('routes material rejection and correction through material review states', async () => {
    const caseId = createCase({ status: 'material_reviewing' });
    const materialId = createMaterial(caseId);

    await request(app)
      .post(`/api/cases/${caseId}/material-review`)
      .set(authHeader(fixtures.users.policeWindow))
      .send({ material_id: materialId, status: 'rejected', review_comment: '缺少原件' })
      .expect(200);

    expect(getCase(caseId).status).toBe('material_correction');

    await request(app)
      .post(`/api/cases/${caseId}/materials/${materialId}/correction`)
      .set(authHeader(fixtures.users.citizen))
      .send({ correction_comment: '已补充原件' })
      .expect(200);

    const material = db.prepare('SELECT * FROM case_materials WHERE id = ?').get(materialId) as any;
    expect(material.status).toBe('pending');
    expect(material.correction_count).toBe(1);
    expect(getCase(caseId).status).toBe('material_reviewing');

    const flows = getFlows(caseId);
    expect(flows.map((flow) => flow.action)).toEqual(['material_review', 'material_correction_submit']);
    expect(flows[0]).toMatchObject({ status: 'material_correction', comment: '材料身份证明审核不通过：缺少原件' });
    expect(flows[1]).toMatchObject({ status: 'material_reviewing', comment: '提交身份证明补正材料：已补充原件' });
  });

  test('keeps accept approve and complete side effects intact', async () => {
    const caseId = createCase({ status: 'accepting' });

    await request(app)
      .post(`/api/cases/${caseId}/accept`)
      .set(authHeader(fixtures.users.policeWindow))
      .send({ comment: '材料齐全' })
      .expect(200);

    expect(getCase(caseId).status).toBe('reviewing');

    await request(app)
      .post(`/api/cases/${caseId}/approve`)
      .set(authHeader(fixtures.users.admin))
      .send({ comment: '审批通过', result: '准予办理' })
      .expect(200);

    const approved = getCase(caseId);
    expect(approved.status).toBe('approved');
    expect(approved.result).toBe('准予办理');

    await request(app)
      .post(`/api/cases/${caseId}/complete`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(200);

    expect(getCase(caseId).status).toBe('completed');

    const notifications = db.prepare('SELECT title FROM notifications WHERE related_id = ? ORDER BY created_at ASC')
      .all(caseId) as any[];
    expect(notifications.map((item) => item.title)).toEqual(['办件已受理', '办件审批通过', '办件已办结']);

    const flows = getFlows(caseId);
    expect(flows.map((flow) => flow.action)).toEqual(['accept', 'approve']);
    expect(flows[1]).toMatchObject({ status: 'approved', from_department_id: fixtures.departments.police });
  });

  test('records cross-department transfer previous status and restores it on return', async () => {
    const caseId = createCase({ status: 'reviewing' });

    await request(app)
      .post(`/api/cases/${caseId}/transfer`)
      .set(authHeader(fixtures.users.admin))
      .send({ to_department_id: fixtures.departments.market, comment: '转市场监管协办' })
      .expect(200);

    let caseItem = getCase(caseId);
    expect(caseItem.status).toBe('cross_department');
    expect(caseItem.department_id).toBe(fixtures.departments.market);

    let flows = getFlows(caseId);
    expect(flows[0]).toMatchObject({
      action: 'transfer',
      status: 'cross_department',
      previous_status: 'reviewing',
      from_department_id: fixtures.departments.police,
      to_department_id: fixtures.departments.market,
    });

    await request(app)
      .post(`/api/cases/${caseId}/return`)
      .set(authHeader(fixtures.users.admin))
      .send({ reason: '资料需原科室补充' })
      .expect(200);

    caseItem = getCase(caseId);
    expect(caseItem.status).toBe('reviewing');
    expect(caseItem.department_id).toBe(fixtures.departments.police);

    flows = getFlows(caseId);
    expect(flows[1]).toMatchObject({
      action: 'return',
      status: 'reviewing',
      previous_status: 'cross_department',
      comment: '资料需原科室补充',
    });
  });

  test('rejects illegal accept transition without writing flow records', async () => {
    const caseId = createCase({ status: 'reviewing' });

    await request(app)
      .post(`/api/cases/${caseId}/accept`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('当前状态不支持受理');
      });

    expect(getCase(caseId).status).toBe('reviewing');
    expect(getFlows(caseId)).toHaveLength(0);
  });
});
