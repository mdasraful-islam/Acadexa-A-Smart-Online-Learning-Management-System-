import mysql from 'mysql2/promise';

function toNumber(value) {
  return Number(value || 0);
}

function courseSummary(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    level: row.level,
    duration: row.duration,
    accent: row.accent,
    description: row.description,
    lessonCount: toNumber(row.lessonCount),
  };
}

export async function createMysqlStore(config) {
  const pool = mysql.createPool({
    host: config.host || '127.0.0.1',
    port: config.port || 3306,
    user: config.user || 'root',
    password: config.password || '',
    database: config.database || 'acadexa',
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
  return new MysqlStore(pool);
}

export class MysqlStore {
  constructor(pool) {
    this.pool = pool;
  }

  async ping() {
    await this.pool.query('SELECT 1');
  }

  async listCourses() {
    const [rows] = await this.pool.execute(
      `SELECT c.id, c.title, c.category, c.level, c.duration, c.accent, c.description,
              (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessonCount
       FROM courses c ORDER BY c.title`,
    );
    return rows.map(courseSummary);
  }

  async getCourse(courseId) {
    const [courses] = await this.pool.execute(
      'SELECT id, title, category, level, duration, accent, description FROM courses WHERE id = ?',
      [courseId],
    );
    if (!courses.length) return null;
    const [lessons] = await this.pool.execute(
      'SELECT id, title, minutes, summary, content FROM lessons WHERE course_id = ? ORDER BY position, id',
      [courseId],
    );
    return { ...courses[0], lessons: lessons.map((lesson) => ({ ...lesson, minutes: toNumber(lesson.minutes) })) };
  }

  async createStudent({ name, email, passwordHash, passwordSalt }) {
    try {
      const [result] = await this.pool.execute(
        'INSERT INTO students (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)',
        [name, email, passwordHash, passwordSalt],
      );
      return { id: String(result.insertId), name, email };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return null;
      throw error;
    }
  }

  async getStudentByEmail(email) {
    const [rows] = await this.pool.execute(
      'SELECT id, name, email, password_hash AS passwordHash, password_salt AS passwordSalt FROM students WHERE email = ?',
      [email],
    );
    if (!rows.length) return null;
    return { ...rows[0], id: String(rows[0].id) };
  }

  async enroll(studentId, courseId) {
    const [courses] = await this.pool.execute('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!courses.length) return null;
    try {
      await this.pool.execute('INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)', [studentId, courseId]);
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }

  async dashboard(studentId) {
    const [students] = await this.pool.execute('SELECT id, name, email FROM students WHERE id = ?', [studentId]);
    if (!students.length) return null;
    const [rows] = await this.pool.execute(
      `SELECT c.id, c.title, c.category, c.level, c.duration, c.accent, c.description,
              COUNT(DISTINCT l.id) AS totalLessons,
              COUNT(DISTINCT p.lesson_id) AS completedLessons,
              GROUP_CONCAT(DISTINCT p.lesson_id ORDER BY p.lesson_id SEPARATOR ',') AS completedLessonIds
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN lessons l ON l.course_id = c.id
       LEFT JOIN lesson_progress p ON p.student_id = e.student_id AND p.lesson_id = l.id
       WHERE e.student_id = ?
       GROUP BY c.id, c.title, c.category, c.level, c.duration, c.accent, c.description
       ORDER BY c.title`,
      [studentId],
    );
    const courses = rows.map((row) => {
      const totalLessons = toNumber(row.totalLessons);
      const completedLessons = toNumber(row.completedLessons);
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        level: row.level,
        duration: row.duration,
        accent: row.accent,
        description: row.description,
        lessonCount: totalLessons,
        totalLessons,
        completedLessons,
        completedLessonIds: row.completedLessonIds ? String(row.completedLessonIds).split(',') : [],
        progressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    });
    return { student: students[0], courses };
  }

  async completeLesson(studentId, courseId, lessonId, completed) {
    const [matches] = await this.pool.execute(
      `SELECT l.id
       FROM lessons l
       JOIN enrollments e ON e.course_id = l.course_id AND e.student_id = ?
       WHERE l.id = ? AND l.course_id = ?`,
      [studentId, lessonId, courseId],
    );
    if (!matches.length) {
      const [lesson] = await this.pool.execute('SELECT id FROM lessons WHERE id = ? AND course_id = ?', [lessonId, courseId]);
      return lesson.length ? { status: 'not-enrolled' } : { status: 'not-found' };
    }
    if (completed) {
      await this.pool.execute(
        `INSERT INTO lesson_progress (student_id, lesson_id, completed_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE completed_at = CURRENT_TIMESTAMP`,
        [studentId, lessonId],
      );
    } else {
      await this.pool.execute('DELETE FROM lesson_progress WHERE student_id = ? AND lesson_id = ?', [studentId, lessonId]);
    }
    return { status: 'ok', completed };
  }

  async close() {
    await this.pool.end();
  }
}
