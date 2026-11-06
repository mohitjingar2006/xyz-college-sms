// =====================================================================
// XYZ College SMS : shared Supabase client + data services (Member C)
// Usage in any page:  <script type="module"> import * as api from './supabaseClient.js'; </script>
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// Paste from Supabase Dashboard > Project Settings > API
export const SUPABASE_URL = 'https://okcvtamvlcrauepojvlc.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_f1c3UyrYBhbWXJ9AP6x9GQ_7iIHTnIx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Constants shared by every member --------------------------
export const ENUMS = {
  programs: ['B.Tech', 'M.Tech', 'B.Sc', 'M.Sc', 'Ph.D.'],
  departments: ['Computer Science & Engineering', 'Electrical Engineering',
                'Mechanical Engineering', 'Civil Engineering', 'Basic Sciences'],
  designations: ['Assistant Professor', 'Associate Professor', 'Professor', 'Assistant Registrar'],
  positions: ['Head of Department', 'Associate Dean of Hostel Affairs', 'Dean of Hostel Affairs',
              'Associate Dean of Mess Affairs', 'None'],
  semesters: [1, 2, 3, 4, 5, 6, 7, 8],
  roles: ['student', 'faculty', 'admin'],
  examTypes: ['internal', 'mid_term', 'final'],
};

export const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  'What was the name of your high school?',
];

export const WINDOW_KEYS = {
  registration: 'registration_window_open',
  facultyApplication: 'faculty_application_window_open',
};

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// Convenience cache of the signed-in profile (Member A's profile component reads it).
// NEVER use it for authorization: real access control is the Supabase session + database rules.
const CACHE_KEY = 'currentUser';
const cacheProfile = (p) => {
  try { p ? localStorage.setItem(CACHE_KEY, JSON.stringify(p)) : localStorage.removeItem(CACHE_KEY); } catch { /* storage unavailable */ }
};

// Strip characters that would break PostgREST .or() filters.
const clean = (s) => String(s ?? '').replace(/[,()%*\\]/g, ' ').trim();

// =====================================================================
// AUTH & PROFILE  (Member A)
// =====================================================================
export async function getProfile(userId) {
  return unwrap(await supabase.from('users').select('*').eq('id', userId).maybeSingle());
}

export async function getCurrentProfile() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) { cacheProfile(null); return null; }
  const profile = await getProfile(data.session.user.id);
  cacheProfile(profile);
  return profile;
}

/** Sign in and verify the account really belongs to the selected role tab. */
export async function login(email, password, role) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error('Invalid email or password.');
  const profile = await getProfile(data.user.id);
  if (!profile || profile.role !== role) {
    await supabase.auth.signOut();
    throw new Error(`This account is not registered as ${role}.`);
  }
  cacheProfile(profile);
  return profile;
}

/** Signs out, clears the cached profile, then redirects (pass null to skip the redirect). */
export async function logout(redirectTo = 'index.html') {
  await supabase.auth.signOut();
  cacheProfile(null);
  if (redirectTo) window.location.href = redirectTo;
}

/** Call at the top of each portal page. Redirects to the landing page if not allowed. */
export async function requireRole(role, redirectTo = 'index.html') {
  const profile = await getCurrentProfile().catch(() => null);
  if (!profile || profile.role !== role) {
    window.location.href = redirectTo;
    return null;
  }
  return profile;
}

/** Forgot-password modal: returns true on success; THROWS an Error if the answers/email are wrong or the account is locked. */
export async function resetPasswordWithSecurity(email, answer1, answer2, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
  const { data, error } = await supabase.rpc('reset_password_with_security', {
    p_email: email.trim().toLowerCase(), p_a1: answer1, p_a2: answer2, p_new_password: newPassword,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error('Incorrect answers, or this account is temporarily locked. Please try again later.');
  return true;
}

export async function setSecurityAnswers(answer1, answer2) {
  const { error } = await supabase.rpc('set_security_answers', { p_a1: answer1, p_a2: answer2 });
  if (error) throw new Error(error.message);
}

const EDITABLE_FIELDS = {
  student: ['phone_number', 'photo_url', 'signature_url', 'home_address',
            'parent_phone_number', 'guardian_phone_number', 'mess_choice'],
  faculty: ['phone_number', 'photo_url', 'signature_url', 'research_topics', 'education_history'],
  admin:   ['name', 'phone_number', 'photo_url', 'signature_url', 'role_title'],
};

/** Inline "Update Profile" form. Only whitelisted fields are sent. */
export async function updateOwnProfile(role, fields) {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) throw new Error('Not signed in.');
  const payload = {};
  for (const k of EDITABLE_FIELDS[role] ?? []) if (k in fields) payload[k] = fields[k];
  const updated = unwrap(await supabase.from('users').update(payload).eq('id', s.session.user.id).select().single());
  cacheProfile(updated);
  return updated;
}

/** Upload a photo or signature. kind = 'photo' | 'signature'. Returns the public URL. */
export async function uploadImage(file, kind, userId) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2 MB.');
  const bucket = kind === 'signature' ? 'signatures' : 'avatars';
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// =====================================================================
// SETTINGS / WINDOW TOGGLES  (Member C)
// =====================================================================
export async function getWindows() {
  const rows = unwrap(await supabase.from('settings').select('key,is_open'));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.is_open]));
  const registration = !!map[WINDOW_KEYS.registration];
  const facultyApplication = !!map[WINDOW_KEYS.facultyApplication];
  return {
    registration, facultyApplication,                       // canonical names
    // compatibility aliases (Member B's pages may check these)
    student_registration_open: registration, student_reg_open: registration,
    faculty_application_open: facultyApplication, faculty_applications_open: facultyApplication,
  };
}

/** Admin only. key = WINDOW_KEYS.registration | WINDOW_KEYS.facultyApplication */
export async function setWindow(key, isOpen) {
  const { data: s } = await supabase.auth.getSession();
  return unwrap(await supabase.from('settings')
    .update({ is_open: isOpen, updated_at: new Date().toISOString(), updated_by: s.session?.user.id })
    .eq('key', key).select().single());
}

// =====================================================================
// ADMIN: METRICS, DIRECTORY, CRUD  (Member C)
// =====================================================================
export async function getCounts() {
  const count = async (role) => {
    const { count: c, error } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('role', role);
    if (error) throw new Error(error.message);
    return c ?? 0;
  };
  const [students, faculty] = await Promise.all([count('student'), count('faculty')]);
  return { students, faculty };
}

/** filters: { department, branch, program, text } */
export async function searchStudents({ department, branch, program, text } = {}, limit = 200) {
  let q = supabase.from('users').select('*').eq('role', 'student').order('name').limit(limit);
  if (department) q = q.eq('department', department);
  if (program) q = q.eq('program', program);
  if (branch) q = q.ilike('branch', `%${clean(branch)}%`);
  if (text && clean(text)) q = q.or(`name.ilike.%${clean(text)}%,email.ilike.%${clean(text)}%`);
  return unwrap(await q);
}

/** filters: { department, designation, text } */
export async function searchFaculty({ department, designation, text } = {}, limit = 200) {
  let q = supabase.from('users').select('*').eq('role', 'faculty').order('name').limit(limit);
  if (department) q = q.eq('department', department);
  if (designation) q = q.eq('designation', designation);
  if (text && clean(text)) q = q.or(`name.ilike.%${clean(text)}%,email.ilike.%${clean(text)}%`);
  return unwrap(await q);
}

/** Full record for the detail modal (photo, signature, hostel, parent contact, research...). */
export async function getUserDetail(userId) {
  return unwrap(await supabase.from('users').select('*').eq('id', userId).single());
}

/**
 * Admin: create a login + profile row.
 * profile  = { role:'student'|'faculty', name, email, phone_number, department, ... }
 * answers  = { a1, a2 }  (security answers, optional but needed for forgot-password)
 * Requires "Confirm email" to be OFF in Supabase Auth settings.
 * A throw-away client is used for signUp so the admin's own session is not replaced.
 */
export async function createAccount(profile, password, answers) {
  if (!['student', 'faculty', 'admin'].includes(profile.role)) throw new Error('Invalid role.');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  const email = profile.email.trim().toLowerCase();

  const tmp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await tmp.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (!id) throw new Error('Could not create login (email may already be registered).');

  const { error: insErr } = await supabase.from('users').insert({ ...profile, email, id });
  if (insErr) {
    // roll back the orphan login
    await supabase.rpc('admin_delete_user', { p_user_id: id });
    throw new Error(insErr.message);
  }
  if (answers?.a1 && answers?.a2 && data.session) {
    await tmp.rpc('set_security_answers', { p_a1: answers.a1, p_a2: answers.a2 });
  }
  return id;
}

/** Admin: update any profile field except id / role / email (those are fixed after creation). */
export async function updateAccount(userId, fields) {
  const { id, role, email, created_at, ...rest } = fields;
  return unwrap(await supabase.from('users').update(rest).eq('id', userId).select().single());
}

/** Admin: delete login + profile + all related records. */
export async function deleteAccount(userId) {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
  if (error) throw new Error(error.message);
}

// =====================================================================
// COURSES, STUDENT & FACULTY OPERATIONS  (Member B)
// =====================================================================
export async function getAllCourses() {
  return unwrap(await supabase.from('courses').select('*').order('id'));
}

// ----- student -----
export async function getMyAttendance() {
  return unwrap(await supabase.from('attendance')
    .select('course_id, attendance_date, status, courses(title)')
    .order('attendance_date', { ascending: false }));
}

export async function getMyMarks() {
  const rows = unwrap(await supabase.from('marks')
    .select('course_id, exam, marks_obtained, max_marks, courses(title)')
    .order('course_id'));
  return rows.map((r) => ({ ...r, score: r.marks_obtained }));   // `score` kept for compatibility
}

export async function getCoursesForSemester(semester, department) {
  let q = supabase.from('courses').select('*').eq('semester', semester).order('id');
  if (department) q = q.eq('department', department);
  return unwrap(await q);
}

export async function getMyRegistrations() {
  return unwrap(await supabase.from('course_registrations')
    .select('id, course_id, semester, courses(title, credits)'));
}

/** Fails at the database level if the admin has the registration window CLOSED. */
export async function registerCourse(courseId, semester) {
  if (!Number.isInteger(semester)) {                        // legacy call registerCourse(courseId, studentId)
    semester = unwrap(await supabase.from('courses').select('semester').eq('id', courseId).single()).semester;
  }
  const { data: s } = await supabase.auth.getSession();
  const { error } = await supabase.from('course_registrations')
    .insert({ student_id: s.session.user.id, course_id: courseId, semester });
  if (error) {
    throw new Error(error.code === '42501'
      ? 'Course registration is currently closed.' : error.message);
  }
}

export async function dropCourse(registrationId) {
  const { error } = await supabase.from('course_registrations').delete().eq('id', registrationId);
  if (error) throw new Error(error.message);
}

export async function getMessOptions() {
  return unwrap(await supabase.from('mess_options').select('name').order('name')).map((r) => r.name);
}

export async function setMessChoice(messName) {
  return updateOwnProfile('student', { mess_choice: messName });
}

export async function submitLeave({ start_date, end_date, reason }) {
  const { data: s } = await supabase.auth.getSession();
  return unwrap(await supabase.from('leaves')
    .insert({ student_id: s.session.user.id, start_date, end_date, reason }).select().single());
}

export async function getMyLeaves() {
  return unwrap(await supabase.from('leaves').select('*').order('created_at', { ascending: false }));
}

// ----- faculty -----
export async function getMyCourses() {
  const me = await getCurrentProfile();
  if (!me?.offered_courses?.length) return [];
  return unwrap(await supabase.from('courses').select('*').in('id', me.offered_courses).order('id'));
}

/** Fails at the database level if the faculty application window is CLOSED. */
export async function applyToTeach(courseId) {
  const { data: s } = await supabase.auth.getSession();
  const { error } = await supabase.from('faculty_course_applications')
    .insert({ faculty_id: s.session.user.id, course_id: courseId });
  if (error) {
    throw new Error(error.code === '42501'
      ? 'Faculty course applications are currently closed.' : error.message);
  }
}

export async function getRoster(courseId) {
  const rows = unwrap(await supabase.from('course_registrations')
    .select('student:users(id, name, email, program, branch, current_semester)')
    .eq('course_id', courseId));
  return rows.map((r) => r.student).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAttendanceForDate(courseId, date) {
  return unwrap(await supabase.from('attendance')
    .select('student_id, status').eq('course_id', courseId).eq('attendance_date', date));
}

/** records = [{ student_id, status: 'present'|'absent' }] */
export async function saveAttendance(courseId, date, records) {
  const { data: s } = await supabase.auth.getSession();
  const rows = records.map((r) => ({
    student_id: r.student_id, course_id: courseId, attendance_date: date,
    status: r.status, marked_by: s.session.user.id,
  }));
  return unwrap(await supabase.from('attendance')
    .upsert(rows, { onConflict: 'student_id,course_id,attendance_date' }).select());
}

export async function getMarksForCourse(courseId, exam) {
  return unwrap(await supabase.from('marks')
    .select('student_id, marks_obtained, max_marks').eq('course_id', courseId).eq('exam', exam));
}

/**
 * Two call styles:
 *   saveMarks(courseId, exam, [{ student_id, marks_obtained, max_marks }])
 *   saveMarks([{ course_id, student_id, exam, score | marks_obtained, max_marks? }])
 * exam = 'internal' | 'mid_term' | 'final'
 */
export async function saveMarks(a, exam, rows) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session.user.id;
  const list = Array.isArray(a)
    ? a.map((r) => ({ ...r }))
    : rows.map((r) => ({ ...r, course_id: a, exam }));
  const payload = list.map((r) => ({
    student_id: r.student_id, course_id: r.course_id, exam: r.exam,
    marks_obtained: Number(r.marks_obtained ?? r.score), max_marks: Number(r.max_marks ?? 100), entered_by: uid,
  }));
  return unwrap(await supabase.from('marks')
    .upsert(payload, { onConflict: 'student_id,course_id,exam' }).select());
}

export async function getLeaveRequests(status = 'pending') {
  let q = supabase.from('leaves')
    .select('*, student:users!leaves_student_id_fkey(id, name, email, program, current_semester)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return unwrap(await q);
}

/** decision = 'approved' | 'rejected' */
export async function reviewLeave(leaveId, decision, remarks = '') {
  const { data: s } = await supabase.auth.getSession();
  return unwrap(await supabase.from('leaves')
    .update({ status: decision, remarks, reviewed_by: s.session.user.id })
    .eq('id', leaveId).select().single());
}

// =====================================================================
// COMPATIBILITY LAYER (names/signatures used by Members A and B)
// =====================================================================
export const getCurrentUser = getCurrentProfile;
export const getCourses = getAllCourses;
export const updateMessChoice = (messChoice) => setMessChoice(messChoice);   // student id comes from the session
export const getCourseRoster = getRoster;
export const getAllLeaves = () => getLeaveRequests(null);
export const updateLeaveStatus = (leaveId, status, remarks = '') => reviewLeave(leaveId, status, remarks);

/** records = [{ course_id, student_id, attendance_date, status: 'present'|'absent' }] */
export async function markAttendance(records) {
  const { data: s } = await supabase.auth.getSession();
  const rows = records.map((r) => ({
    student_id: r.student_id, course_id: r.course_id, attendance_date: r.attendance_date,
    status: r.status, marked_by: s.session.user.id,
  }));
  return unwrap(await supabase.from('attendance')
    .upsert(rows, { onConflict: 'student_id,course_id,attendance_date' }).select());
}

// =====================================================================
// GLOBALS for classic (non-module) scripts, e.g. Member A's index.html
// Load this file with <script type="module" src="supabaseClient.js"></script>, then use the
// globals after the 'sms-ready' event (or window.load) fires.
// =====================================================================
const bridge = {
  ENUMS, SECURITY_QUESTIONS, WINDOW_KEYS,
  login, logout, requireRole, getProfile, getCurrentProfile, getCurrentUser,
  resetPasswordWithSecurity, setSecurityAnswers, updateOwnProfile, uploadImage,
};
Object.assign(window, bridge);
window.SMS_API = bridge;
window.dispatchEvent(new Event('sms-ready'));