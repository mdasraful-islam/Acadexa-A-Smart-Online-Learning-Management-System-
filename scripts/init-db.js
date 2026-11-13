import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';

import { DEMO_COURSES } from '../src/data/catalog.js';

const connection = await createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'acadexa',
  charset: 'utf8mb4',
});

try {
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await connection.query(statement);

  for (const course of DEMO_COURSES) {
    await connection.execute(
      `INSERT INTO courses (id, title, category, level, duration, accent, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), category = VALUES(category), level = VALUES(level),
         duration = VALUES(duration), accent = VALUES(accent), description = VALUES(description)`,
      [course.id, course.title, course.category, course.level, course.duration, course.accent, course.description],
    );
    for (const [position, lesson] of course.lessons.entries()) {
      await connection.execute(
        `INSERT INTO lessons (id, course_id, title, minutes, summary, content, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE course_id = VALUES(course_id), title = VALUES(title), minutes = VALUES(minutes),
           summary = VALUES(summary), content = VALUES(content), position = VALUES(position)`,
        [lesson.id, course.id, lesson.title, lesson.minutes, lesson.summary, lesson.content, position + 1],
      );
    }
  }
  console.log(`Acadexa schema ready; seeded ${DEMO_COURSES.length} sample courses.`);
} finally {
  await connection.end();
}
