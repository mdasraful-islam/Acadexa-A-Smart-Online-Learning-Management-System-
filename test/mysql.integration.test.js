import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import 'dotenv/config';
import { createApp } from '../src/app.js';
import { createMysqlStore } from '../src/db/mysql-store.js';

const enabled = process.env.TEST_MYSQL === '1';
const password = ['ci', 'mysql', 'integration', 'password'].join('-');
const sessionSecret = ['ci', 'integration', 'session', 'secret', 'value'].join('-');

function cookieFrom(response) {
  const header = response.headers.get('set-cookie');
  assert.ok(header, 'expected an authentication session cookie');
  return header.split(';', 1)[0];
}

async function readJson(response) {
  return response.json();
}

test('MySQL mode supports registration, login, enrollment, progress, and logout', { skip: !enabled }, async (t) => {
  const store = await createMysqlStore({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  t.after(() => store.close());
  await store.ping();

  const server = createApp({ store, sessionSecret }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(async () => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = `ci-${randomUUID()}@example.test`;

  const catalogResponse = await fetch(`${base}/api/courses`);
  const catalog = await readJson(catalogResponse);
  assert.equal(catalogResponse.status, 200);
  assert.ok(catalog.some((course) => course.id === 'course-ml'));

  const registration = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'CI Learner', email, password }),
  });
  assert.equal(registration.status, 201);
  const registeredCookie = cookieFrom(registration);
  const student = await readJson(registration);
  assert.equal(student.student.email, email);

  const wrongPassword = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: `${password}-wrong` }),
  });
  assert.equal(wrongPassword.status, 401);

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: email.toUpperCase(), password }),
  });
  assert.equal(login.status, 200);
  const loginCookie = cookieFrom(login);
  assert.notEqual(loginCookie, registeredCookie, 'login should rotate the session identifier');
  await login.text();

  const detailsResponse = await fetch(`${base}/api/courses/course-ml`);
  const details = await readJson(detailsResponse);
  assert.equal(detailsResponse.status, 200);
  assert.ok(Array.isArray(details.lessons) && details.lessons.length > 0);
  const enroll = await fetch(`${base}/api/enrollments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: loginCookie },
    body: JSON.stringify({ courseId: 'course-ml' }),
  });
  assert.equal(enroll.status, 201);
  await enroll.text();

  const duplicateEnrollment = await fetch(`${base}/api/enrollments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: loginCookie },
    body: JSON.stringify({ courseId: 'course-ml' }),
  });
  assert.equal(duplicateEnrollment.status, 409);
  await duplicateEnrollment.text();

  const lesson = details.lessons[0];
  const completion = await fetch(`${base}/api/courses/course-ml/lessons/${lesson.id}/completion`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: loginCookie },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(completion.status, 200);
  await completion.text();

  const dashboardResponse = await fetch(`${base}/api/dashboard`, { headers: { cookie: loginCookie } });
  const dashboard = await readJson(dashboardResponse);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboard.courses[0].completedLessons, 1);
  assert.deepEqual(dashboard.courses[0].completedLessonIds, [lesson.id]);

  const logout = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: loginCookie },
  });
  assert.equal(logout.status, 204);
  await logout.text();

  const afterLogout = await fetch(`${base}/api/me`, { headers: { cookie: loginCookie } });
  assert.equal(afterLogout.status, 401);
  await afterLogout.text();
});
