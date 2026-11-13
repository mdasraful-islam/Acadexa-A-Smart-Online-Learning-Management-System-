const state = { courses: [], student: null, dashboard: null, selectedCourse: null };
const $ = (selector) => document.querySelector(selector);
const courseGrid = $('#course-grid');
const dialog = $('#course-dialog');
const dialogContent = $('#dialog-content');
let toastTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function setStudent(student) {
  state.student = student;
  $('#header-user').textContent = student ? student.name : 'Guest learner';
  $('#avatar').textContent = student ? student.name.trim().charAt(0).toUpperCase() : 'A';
  $('#account-status').hidden = !student;
  $('#account-status').textContent = student ? `Signed in as ${student.email}` : '';
  $('#logout-button').hidden = !student;
  $('#account-open').hidden = Boolean(student);
  $('#account-box').hidden = Boolean(student);
}

function courseCard(course) {
  const card = element('article', 'course-card');
  const accent = element('div', `course-accent ${course.accent || ''}`);
  accent.setAttribute('aria-hidden', 'true');
  const meta = element('div', 'course-meta');
  meta.append(element('span', 'pill', course.category), element('span', 'pill', course.level));
  const title = element('h3', '', course.title);
  const description = element('p', '', course.description);
  const footer = element('div', 'course-card-footer');
  footer.append(element('small', '', `${course.lessonCount} short lessons · ${course.duration}`));
  const button = element('button', 'button button-secondary', 'View course');
  button.type = 'button';
  button.addEventListener('click', () => openCourse(course.id));
  footer.append(button);
  card.append(accent, meta, title, description, footer);
  return card;
}

function renderCourses() {
  const query = $('#course-search').value.trim().toLowerCase();
  const filtered = state.courses.filter((course) => `${course.title} ${course.category} ${course.description}`.toLowerCase().includes(query));
  courseGrid.replaceChildren(...filtered.map(courseCard));
  $('#empty-courses').hidden = filtered.length > 0;
}

function renderDashboard() {
  const list = $('#dashboard-list');
  list.replaceChildren();
  const courses = state.dashboard?.courses || [];
  $('#course-total').textContent = `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`;
  $('#dashboard-empty').hidden = courses.length > 0;
  for (const course of courses) {
    const card = element('article', 'dashboard-card');
    const text = element('div');
    text.append(element('span', 'pill pill-neutral', course.category));
    text.append(element('h3', '', course.title));
    text.append(element('p', '', `${course.completedLessons} of ${course.totalLessons} lessons complete · ${course.duration}`));
    const progress = element('div', 'progress-side');
    const label = element('div', 'progress-label');
    label.append(element('span', '', 'Course progress'), element('strong', '', `${course.progressPercent}%`));
    const track = element('div', 'progress-track');
    const fill = element('div', 'progress-fill');
    fill.style.width = `${course.progressPercent}%`;
    track.append(fill);
    const button = element('button', 'button button-primary', 'Continue learning');
    button.type = 'button';
    button.addEventListener('click', () => openCourse(course.id));
    progress.append(label, track, button);
    card.append(text, progress);
    list.append(card);
  }
}

function markView(view) {
  const dashboard = view === 'dashboard';
  $('#catalog-view').hidden = dashboard;
  $('#dashboard-view').hidden = !dashboard;
  $('#page-title').textContent = dashboard ? 'Your learning space' : 'Find your next course';
  $('#breadcrumb-current').textContent = dashboard ? 'MY LEARNING' : 'EXPLORE';
  document.querySelectorAll('[data-route]').forEach((button) => {
    if (button.classList.contains('nav-link')) button.classList.toggle('active', button.dataset.route === view);
  });
}

async function refreshDashboard() {
  if (!state.student) {
    state.dashboard = null;
    renderDashboard();
    return;
  }
  state.dashboard = await api('/api/dashboard');
  renderDashboard();
}

async function openCourse(courseId) {
  try {
    const course = await api(`/api/courses/${encodeURIComponent(courseId)}`);
    state.selectedCourse = course;
    await renderCourseDetails(course);
    dialog.showModal();
  } catch (error) {
    notify(error.message);
  }
}

async function renderCourseDetails(course) {
  dialogContent.replaceChildren();
  dialogContent.append(element('span', 'pill pill-blue', `${course.category} · ${course.level}`));
  dialogContent.append(element('h2', 'dialog-heading', course.title));
  dialogContent.append(element('p', 'dialog-description', course.description));

  const enrolled = Boolean(state.dashboard?.courses?.some((item) => item.id === course.id));
  const footer = element('div', 'lesson-footer');
  footer.append(element('small', '', `${course.lessons.length} lessons · ${course.duration}`));
  if (enrolled) {
    footer.append(element('span', 'enrolled-label', '✓ Enrolled'));
  } else {
    const enroll = element('button', 'button button-primary', state.student ? 'Enroll in course' : 'Sign in to enroll');
    enroll.type = 'button';
    enroll.addEventListener('click', async () => {
      if (!state.student) {
        dialog.close();
        $('#account-box').open = true;
        $('#register-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      try {
        await api('/api/enrollments', { method: 'POST', body: JSON.stringify({ courseId: course.id }) });
        await refreshDashboard();
        notify('You are enrolled. Your course is in My learning.');
        await renderCourseDetails(course);
      } catch (error) {
        notify(error.message);
      }
    });
    footer.append(enroll);
  }
  dialogContent.append(footer);

  const lessons = element('div', 'lesson-list');
  const completedIds = new Set();
  if (enrolled) {
    const dashboardCourse = state.dashboard.courses.find((item) => item.id === course.id);
    // Per-lesson state is fetched only through the course panel; dashboard keeps aggregate progress.
    if (dashboardCourse?.completedLessonIds) dashboardCourse.completedLessonIds.forEach((id) => completedIds.add(id));
  }
  for (const lesson of course.lessons) {
    const item = element('article', 'lesson-item');
    item.append(element('h3', '', lesson.title));
    item.append(element('p', '', lesson.summary));
    const content = element('p', 'lesson-content', lesson.content);
    item.append(content);
    const lessonFooter = element('div', 'lesson-footer');
    lessonFooter.append(element('small', '', `${lesson.minutes} min`));
    if (enrolled) {
      const complete = element('button', 'button button-secondary', completedIds.has(lesson.id) ? 'Completed' : 'Mark complete');
      complete.type = 'button';
      complete.disabled = completedIds.has(lesson.id);
      complete.addEventListener('click', async () => {
        try {
          await api(`/api/courses/${encodeURIComponent(course.id)}/lessons/${encodeURIComponent(lesson.id)}/completion`, {
            method: 'PATCH', body: JSON.stringify({ completed: true }),
          });
          await refreshDashboard();
          await renderCourseDetails(course);
          notify('Lesson progress saved.');
        } catch (error) {
          notify(error.message);
        }
      });
      lessonFooter.append(complete);
    }
    item.append(lessonFooter);
    lessons.append(item);
  }
  dialogContent.append(lessons);
}

async function submitAuth(form, mode) {
  const payload = Object.fromEntries(new FormData(form));
  try {
    const result = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(payload) });
    setStudent(result.student);
    $('#account-box').open = false;
    await refreshDashboard();
    notify(mode === 'register' ? 'Account created. You are signed in.' : 'Signed in.');
  } catch (error) {
    notify(error.message);
  }
}

function showAuthMode(mode) {
  $('#register-form').hidden = mode !== 'register';
  $('#login-form').hidden = mode !== 'login';
  $('#account-box').open = true;
}

async function showDashboard() {
  if (!state.student) {
    $('#account-box').open = true;
    $('#login-form').hidden = false;
    $('#register-form').hidden = true;
    notify('Sign in to see your learning dashboard.');
    return;
  }
  try {
    await refreshDashboard();
    markView('dashboard');
  } catch (error) {
    notify(error.message);
  }
}

document.querySelectorAll('[data-route]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.route === 'dashboard') showDashboard();
    else markView('explore');
  });
});
$('#course-search').addEventListener('input', renderCourses);
$('#show-login').addEventListener('click', () => showAuthMode('login'));
$('#show-register').addEventListener('click', () => showAuthMode('register'));
$('#account-open').addEventListener('click', () => {
  $('#account-box').open = true;
  $('#register-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('#register-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, 'register');
});
$('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, 'login');
});
$('#logout-button').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    setStudent(null);
    state.dashboard = null;
    renderDashboard();
    markView('explore');
    notify('Signed out.');
  } catch (error) {
    notify(error.message);
  }
});

async function boot() {
  try {
    const catalog = await api('/api/courses');
    state.courses = catalog;
    renderCourses();
    const me = await api('/api/me').catch(() => null);
    if (me?.student) {
      setStudent(me.student);
      await refreshDashboard();
    }
  } catch (error) {
    notify(`Could not load Acadexa: ${error.message}`);
  }
}
boot();
