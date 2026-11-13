import { promisify } from 'node:util';
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import session from 'express-session';

const scrypt = promisify(nodeScrypt);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

function safeStudent(student) {
  if (!student) return null;
  const { passwordHash, passwordSalt, ...safe } = student;
  return safe;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return { passwordSalt: salt, passwordHash: hash.toString('hex') };
}

async function verifyPassword(password, salt, storedHash) {
  if (!salt || !storedHash) return false;
  const expected = Buffer.from(storedHash, 'hex');
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

function requireStudent(req, res, next) {
  if (!req.session?.student) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function createApp({ store, sessionSecret, secureCookies = false } = {}) {
  if (!store) throw new TypeError('A data store is required');
  if (typeof sessionSecret !== 'string' || sessionSecret.length < 16) {
    throw new TypeError('SESSION_SECRET must be at least 16 characters');
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(session({
    name: 'acadexa.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      maxAge: 1000 * 60 * 60 * 24,
    },
  }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/courses', async (_req, res, next) => {
    try {
      res.json(await store.listCourses());
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/courses/:courseId', async (req, res, next) => {
    try {
      const course = await store.getCourse(req.params.courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      res.json(course);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (name.length < 2 || name.length > 80 || !emailPattern.test(email) || password.length < 10 || password.length > 200) {
        return res.status(400).json({ error: 'Enter a name, valid email, and password of at least 10 characters' });
      }

      const credentials = await hashPassword(password);
      const student = await store.createStudent({ name, email, ...credentials });
      if (!student) return res.status(409).json({ error: 'An account with that email already exists' });

      await regenerateSession(req);
      req.session.student = safeStudent(student);
      await saveSession(req);
      res.status(201).json({ student: req.session.student });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!emailPattern.test(email) || password.length === 0) {
        return res.status(400).json({ error: 'Enter a valid email and password' });
      }
      const student = await store.getStudentByEmail(email);
      const valid = student && await verifyPassword(password, student.passwordSalt, student.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Email or password is incorrect' });

      await regenerateSession(req);
      req.session.student = safeStudent(student);
      await saveSession(req);
      res.json({ student: req.session.student });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      if (req.session) await destroySession(req);
      res.clearCookie('acadexa.sid', { httpOnly: true, sameSite: 'lax', secure: secureCookies });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/me', requireStudent, (req, res) => res.json({ student: req.session.student }));

  app.get('/api/dashboard', requireStudent, async (req, res, next) => {
    try {
      const dashboard = await store.dashboard(req.session.student.id);
      if (!dashboard) return res.status(401).json({ error: 'Authentication required' });
      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/enrollments', requireStudent, async (req, res, next) => {
    try {
      const courseId = typeof req.body?.courseId === 'string' ? req.body.courseId : '';
      if (!courseId) return res.status(400).json({ error: 'courseId is required' });
      const result = await store.enroll(req.session.student.id, courseId);
      if (result === null) return res.status(404).json({ error: 'Course not found' });
      if (result === false) return res.status(409).json({ error: 'Already enrolled in this course' });
      res.status(201).json({ enrolled: true, courseId });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/courses/:courseId/lessons/:lessonId/completion', requireStudent, async (req, res, next) => {
    try {
      if (typeof req.body?.completed !== 'boolean') {
        return res.status(400).json({ error: 'completed must be a boolean' });
      }
      const result = await store.completeLesson(
        req.session.student.id,
        req.params.courseId,
        req.params.lessonId,
        req.body.completed,
      );
      if (result.status === 'not-found') return res.status(404).json({ error: 'Course or lesson not found' });
      if (result.status === 'not-enrolled') return res.status(403).json({ error: 'Enroll in this course first' });
      res.json({ completed: result.completed });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  app.use(express.static(path.resolve(publicDir)));
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
