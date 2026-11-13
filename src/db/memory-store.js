import { randomUUID } from 'node:crypto';

import { cloneCourses } from '../data/catalog.js';

function publicCourse(course) {
  const { lessons, ...summary } = course;
  return { ...summary, lessonCount: lessons.length };
}

function safeStudent(student) {
  if (!student) return null;
  const { passwordHash, passwordSalt, ...safe } = student;
  return { ...safe };
}

export class MemoryStore {
  constructor(courses) {
    this.courses = cloneCourses(courses);
    this.students = new Map();
    this.studentIdsByEmail = new Map();
    this.enrollments = new Map();
  }

  async listCourses() {
    return this.courses.map(publicCourse);
  }

  async getCourse(courseId) {
    const course = this.courses.find((item) => item.id === courseId);
    return course ? structuredClone(course) : null;
  }

  async createStudent({ name, email, passwordHash, passwordSalt }) {
    if (this.studentIdsByEmail.has(email)) return null;
    const student = { id: randomUUID(), name, email, passwordHash, passwordSalt };
    this.students.set(student.id, student);
    this.studentIdsByEmail.set(email, student.id);
    return safeStudent(student);
  }

  async getStudentByEmail(email) {
    const id = this.studentIdsByEmail.get(email);
    return id ? structuredClone(this.students.get(id)) : null;
  }

  async enroll(studentId, courseId) {
    if (!this.courses.some((course) => course.id === courseId)) return null;
    const key = `${studentId}:${courseId}`;
    if (this.enrollments.has(key)) return false;
    this.enrollments.set(key, new Set());
    return true;
  }

  async completeLesson(studentId, courseId, lessonId, completed) {
    const course = this.courses.find((item) => item.id === courseId);
    if (!course || !course.lessons.some((lesson) => lesson.id === lessonId)) return { status: 'not-found' };
    const progress = this.enrollments.get(`${studentId}:${courseId}`);
    if (!progress) return { status: 'not-enrolled' };
    if (completed) progress.add(lessonId);
    else progress.delete(lessonId);
    return { status: 'ok', completed: progress.has(lessonId) };
  }

  async dashboard(studentId) {
    const student = this.students.get(studentId);
    if (!student) return null;
    const courses = [];
    for (const course of this.courses) {
      const completed = this.enrollments.get(`${studentId}:${course.id}`);
      if (!completed) continue;
      const totalLessons = course.lessons.length;
      const completedLessons = completed.size;
      courses.push({
        ...publicCourse(course),
        totalLessons,
        completedLessons,
        completedLessonIds: [...completed],
        progressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      });
    }
    return { student: safeStudent(student), courses };
  }
}
