import express from 'express';
import request from 'supertest';
import db from '../database';
import appointmentRoutes from '../routes/appointment';
import ticketRoutes from '../routes/ticket';
import {
  authHeader,
  createAppointment,
  fixtures,
  futureDate,
  getTicketByAppointment,
  resetDatabase,
} from './helpers';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/tickets', ticketRoutes);
  return app;
}

describe('appointment check-in ticket routes', () => {
  const app = createApp();

  beforeEach(() => {
    resetDatabase();
  });

  test('creates a waiting ticket for a confirmed appointment and marks appointment completed', async () => {
    const appointmentId = createAppointment({ status: 'confirmed' });

    const response = await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(201);

    expect(response.body.is_idempotent).toBe(false);
    expect(response.body.ticket).toMatchObject({
      appointment_id: appointmentId,
      service_item_id: fixtures.services.idCard,
      user_id: fixtures.users.citizen,
      status: 'waiting',
      applicant_name: '测试群众',
    });
    expect(response.body.ticket.ticket_number).toMatch(/^SFZ-\d{3}$/);

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as any;
    expect(appointment.status).toBe('completed');
    expect(getTicketByAppointment(appointmentId).id).toBe(response.body.ticket.id);
  });

  test('blocks duplicate check-in by returning the existing ticket without creating another one', async () => {
    const appointmentId = createAppointment({ status: 'confirmed' });

    const first = await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(201);

    const second = await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(200);

    expect(second.body.is_idempotent).toBe(true);
    expect(second.body.ticket.id).toBe(first.body.ticket.id);
    const count = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE appointment_id = ?')
      .get(appointmentId) as any;
    expect(count.count).toBe(1);
  });

  test('rejects window staff checking in appointments from another department', async () => {
    const appointmentId = createAppointment({
      status: 'confirmed',
      serviceItemId: fixtures.services.idCard,
    });

    await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.marketWindow))
      .expect(403);

    expect(getTicketByAppointment(appointmentId)).toBeUndefined();
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as any;
    expect(appointment.status).toBe('confirmed');
  });

  test.each(['pending', 'cancelled'])('does not create a ticket when appointment status is %s', async (status) => {
    const appointmentId = createAppointment({ status });

    await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(400);

    expect(getTicketByAppointment(appointmentId)).toBeUndefined();
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as any;
    expect(appointment.status).toBe(status);
  });

  test('does not create a ticket for completed appointment without an existing ticket', async () => {
    const appointmentId = createAppointment({ status: 'completed' });

    await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(400);

    expect(getTicketByAppointment(appointmentId)).toBeUndefined();
  });

  test('allows admin to check in an appointment across departments', async () => {
    const appointmentId = createAppointment({
      serviceItemId: fixtures.services.license,
      status: 'confirmed',
    });

    const response = await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.admin))
      .expect(201);

    expect(response.body.ticket.ticket_number).toMatch(/^YYZZ-\d{3}$/);
    expect(response.body.ticket.appointment_id).toBe(appointmentId);
  });

  test('supports the route chain from creating an appointment through completing the issued ticket', async () => {
    const appointmentDate = futureDate(3);
    const createResponse = await request(app)
      .post('/api/appointments')
      .set(authHeader(fixtures.users.citizen))
      .send({
        service_item_id: fixtures.services.idCard,
        appointment_date: appointmentDate,
        time_slot: '10:00-11:00',
      })
      .expect(201);

    const appointmentId = createResponse.body.appointment.id;
    expect(createResponse.body.appointment.status).toBe('confirmed');

    const checkInResponse = await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(201);

    const ticketId = checkInResponse.body.ticket.id;

    const callResponse = await request(app)
      .post(`/api/tickets/${ticketId}/call`)
      .set(authHeader(fixtures.users.policeWindow))
      .send({ window_id: fixtures.windows.police })
      .expect(200);
    expect(callResponse.body.ticket.status).toBe('calling');
    expect(callResponse.body.ticket.call_count).toBe(1);

    const startResponse = await request(app)
      .post(`/api/tickets/${ticketId}/start`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(200);
    expect(startResponse.body.ticket.status).toBe('processing');

    const completeResponse = await request(app)
      .post(`/api/tickets/${ticketId}/complete`)
      .set(authHeader(fixtures.users.policeWindow))
      .expect(200);
    expect(completeResponse.body.ticket.status).toBe('completed');

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
    expect(ticket.status).toBe('completed');
  });
});
