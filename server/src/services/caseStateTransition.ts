import { v4 as uuidv4 } from 'uuid';
import type { CaseStatus } from '../types';

type Database = any;

export interface CaseRecord {
  id: string;
  case_number: string;
  status: CaseStatus;
  user_id?: string | null;
  ticket_id?: string | null;
  department_id?: string | null;
  current_handler_id?: string | null;
}

export interface CaseFlowInput {
  case_id: string;
  action: string;
  status: CaseStatus;
  previous_status?: CaseStatus | string | null;
  comment?: string | null;
  from_department_id?: string | null;
  to_department_id?: string | null;
  from_user_id?: string | null;
  to_user_id?: string | null;
  handled_at?: boolean;
}

export interface CaseNotificationInput {
  user_id?: string | null;
  type?: string;
  title: string;
  content: string;
  related_id: string;
}

export interface OperationLogInput {
  user_id: string;
  user_name: string;
  action: string;
  module: string;
  detail: string;
}

export interface CaseTransitionInput {
  caseItem: CaseRecord;
  toStatus: CaseStatus;
  allowedFrom?: CaseStatus[];
  invalidMessage?: string;
  updateSetSql?: string;
  updateParams?: unknown[];
  flow?: Omit<CaseFlowInput, 'case_id' | 'status'> & {
    status?: CaseStatus;
  };
  notification?: CaseNotificationInput | null;
  operationLog?: OperationLogInput | null;
  afterCaseUpdate?: () => void;
}

export function assertCaseTransition(
  currentStatus: CaseStatus,
  allowedStatuses: CaseStatus[],
  message: string
) {
  if (!allowedStatuses.includes(currentStatus)) {
    throw new Error(message);
  }
}

export function resolveMaterialReviewStatus(database: Database, caseId: string, fallbackStatus: CaseStatus): CaseStatus {
  const allMaterials = database.prepare('SELECT status FROM case_materials WHERE case_id = ?').all(caseId) as any[];
  if (allMaterials.length === 0) return fallbackStatus;

  const hasRejected = allMaterials.some((material) => material.status === 'rejected');
  if (hasRejected) return 'material_correction';

  const hasPending = allMaterials.some((material) => material.status === 'pending');
  return hasPending ? 'material_reviewing' : 'accepting';
}

export function insertCaseFlow(database: Database, flow: CaseFlowInput) {
  database.prepare(`
    INSERT INTO case_flows (id, case_id, from_department_id, to_department_id,
      from_user_id, to_user_id, action, status, previous_status, comment, handled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${flow.handled_at ? 'CURRENT_TIMESTAMP' : 'NULL'})
  `).run(
    uuidv4(),
    flow.case_id,
    flow.from_department_id || null,
    flow.to_department_id || null,
    flow.from_user_id || null,
    flow.to_user_id || null,
    flow.action,
    flow.status,
    flow.previous_status || null,
    flow.comment || null
  );
}

export function insertCaseNotification(database: Database, notification?: CaseNotificationInput | null) {
  if (!notification?.user_id) return;

  database.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, related_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    notification.user_id,
    notification.type || 'case',
    notification.title,
    notification.content,
    notification.related_id
  );
}

export function insertOperationLog(database: Database, log?: OperationLogInput | null) {
  if (!log) return;

  database.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(log.user_id, log.user_name, log.action, log.module, log.detail);
}

export function applyCaseTransition(database: Database, input: CaseTransitionInput) {
  if (input.allowedFrom && input.invalidMessage) {
    assertCaseTransition(input.caseItem.status, input.allowedFrom, input.invalidMessage);
  }

  const updateSetSql = input.updateSetSql ? `, ${input.updateSetSql}` : '';
  database.prepare(`
    UPDATE cases SET status = ?${updateSetSql}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(input.toStatus, ...(input.updateParams || []), input.caseItem.id);

  if (input.afterCaseUpdate) {
    input.afterCaseUpdate();
  }

  if (input.flow) {
    insertCaseFlow(database, {
      case_id: input.caseItem.id,
      action: input.flow.action,
      status: input.flow.status || input.toStatus,
      previous_status: input.flow.previous_status,
      comment: input.flow.comment,
      from_department_id: input.flow.from_department_id,
      to_department_id: input.flow.to_department_id,
      from_user_id: input.flow.from_user_id,
      to_user_id: input.flow.to_user_id,
      handled_at: input.flow.handled_at,
    });
  }

  insertCaseNotification(database, input.notification);
  insertOperationLog(database, input.operationLog);
}
