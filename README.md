# Acadexa

Acadexa is a small learning-management-system MVP built around the project described in the CV: course discovery, enrollment, a student dashboard, and lesson delivery.

The included courses and lessons are **sample content**, not official AIUB courses or materials.

## Features

- Search a course catalog and read lesson material.
- Create an account, sign in, and sign out.
- Enroll in courses and track completed lessons.
- Store accounts, courses, enrollments, and progress in MySQL.
- Run a no-database demo mode for local exploration.
- Use parameterized SQL, scrypt password hashes, and HttpOnly/SameSite session cookies.
- Run automated API tests with Node's built-in test runner.

## Run the demo

Requirements: Node.js 20 or newer.

```bash
npm install
npm start
```

Open `http://localhost:3000`. The default `DB_MODE=demo` keeps accounts and progress in memory; data resets when the server stops. There is no shared demo account. Create an account locally to try enrollment and progress tracking.

## Use MySQL for persistent course data

1. Install and start MySQL separately, then create a database:

   ```sql
   CREATE DATABASE acadexa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Copy `.env.example` to `.env`, set `DB_MODE=mysql`, and enter the MySQL connection details. Set `SESSION_SECRET` to a random value of at least 32 characters. One way to generate one is:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Create the tables and insert the sample courses:

   ```bash
   npm run db:init
   ```

4. Start the server:

   ```bash
   npm start
   ```

`schema.sql` defines students, courses, lessons, enrollments, and lesson progress. MySQL mode persists application data; sessions use Express's in-process session store in this MVP, so users need to sign in again after a server restart. Add a persistent session store, HTTPS, rate limiting, and CSRF protection before a public production deployment.

## Tests

```bash
npm test
```

The API tests use the real in-memory store and exercise registration, authentication, course access, enrollment, duplicate prevention, and lesson progress. A MySQL server is not bundled, so the MySQL adapter and schema still need an integration run against a MySQL instance before production use.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/courses` | List courses |
| `GET` | `/api/courses/:courseId` | Course details and lessons |
| `POST` | `/api/auth/register` | Create an account and sign in |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/me` | Current student |
| `GET` | `/api/dashboard` | Enrolled courses and progress |
| `POST` | `/api/enrollments` | Enroll in a course |
| `PATCH` | `/api/courses/:courseId/lessons/:lessonId/completion` | Mark a lesson complete or incomplete |

## Project structure

```text
public/          Responsive browser UI
src/app.js       HTTP routes, validation, and sessions
src/data/        Sample course catalog and lesson content
src/db/          In-memory demo store and MySQL adapter
scripts/         MySQL schema and sample-data initializer
schema.sql       MySQL tables and constraints
test/            API behavior tests
```
