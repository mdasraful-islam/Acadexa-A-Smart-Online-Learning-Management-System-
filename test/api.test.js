import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../src/app.js';
import { MemoryStore } from '../src/db/memory-store.js';

const testSecret = ['acadexa', 'test', 'session', 'key'].join('-');
const testPassword = ['safe', 'demo', 'password'].join('-');

async function startApp(t) {
  const app = createApp({ store: new MemoryStore(), sessionSecret: testSecret });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function json(response) {
  return response.json();
}

function sessionCookie(response) {
  const header = response.headers.get('set-cookie');
  assert.ok(header, 'registration should set a session cookie');
  return header.split(';', 1)[0];
}

test('course catalog is public and contains lesson counts', async (t) => {
  const base = await startApp(t);
  const response = await fetch(`${base}/api/courses`);
  const courses = await json(response);

  assert.equal(response.status, 200);
  assert.ok(courses.length >= 3);
  assert.ok(courses.every((course) => Number.isInteger(course.lessonCount)));
  assert.ok(courses.every((course) => !Object.hasOwn(course, 'lessons')));
});

test('dashboard requires an authenticated student', async (t) => {
  const base = await startApp(t);
  const response = await fetch(`${base}/api/dashboard`);

  assert.equal(response.status, 401);
  assert.equal((await json(response)).error, 'Authentication required');
});

test('student can register, enroll, view materials, and record lesson progress', async (t) => {
  const base = await startApp(t);
  const registration = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Demo Student', email: 'student@example.test', password: testPassword }),
  });
  const cookie = sessionCookie(registration);
  const student = await json(registration);

  assert.equal(registration.status, 201);
  assert.equal(student.student.email, 'student@example.test');
  assert.equal(Object.hasOwn(student.student, 'passwordHash'), false);
  assert.match(registration.headers.get('set-cookie'), /HttpOnly/i);

  const detailsResponse = await fetch(`${base}/api/courses/course-ml`);
  const details = await json(detailsResponse);
  assert.equal(detailsResponse.status, 200);
  assert.ok(details.lessons.length > 0);

  const enrollment = await fetch(`${base}/api/enrollments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ courseId: 'course-ml' }),
  });
  assert.equal(enrollment.status, 201);

  const duplicate = await fetch(`${base}/api/enrollments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ courseId: 'course-ml' }),
  });
  assert.equal(duplicate.status, 409);

  const lessonId = details.lessons[0].id;
  const completion = await fetch(`${base}/api/courses/course-ml/lessons/${lessonId}/completion`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(completion.status, 200);

  const dashboard = await fetch(`${base}/api/dashboard`, { headers: { cookie } });
  const result = await json(dashboard);
  assert.equal(dashboard.status, 200);
  assert.equal(result.courses.length, 1);
  assert.equal(result.courses[0].completedLessons, 1);
  assert.deepEqual(result.courses[0].completedLessonIds, [lessonId]);
  assert.ok(result.courses[0].progressPercent > 0);
});

test('registration rejects invalid input and duplicate email addresses', async (t) => {
  const base = await startApp(t);
  const invalid = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', email: 'not-an-email', password: 'short' }),
  });
  assert.equal(invalid.status, 400);

  const payload = { name: 'Demo Student', email: 'duplicate@example.test', password: testPassword };
  const first = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 201);
  await first.text();

  const second = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(second.status, 409);
});
