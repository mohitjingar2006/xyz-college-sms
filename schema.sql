-- =====================================================================
-- XYZ College SMS : Supabase schema (Member C)
-- Run ONCE in Supabase Dashboard > SQL Editor on a fresh project.
-- Before using the app: Authentication > Providers > Email > turn OFF "Confirm email".
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- ENUMS ----------------------------------------------------
create type user_role         as enum ('student', 'faculty', 'admin');
create type program_type      as enum ('B.Tech', 'M.Tech', 'B.Sc', 'M.Sc', 'Ph.D.');
create type department_type   as enum ('Computer Science & Engineering', 'Electrical Engineering',
                                       'Mechanical Engineering', 'Civil Engineering', 'Basic Sciences');
create type designation_type  as enum ('Assistant Professor', 'Associate Professor', 'Professor', 'Assistant Registrar');
create type position_type     as enum ('Head of Department', 'Associate Dean of Hostel Affairs',
                                       'Dean of Hostel Affairs', 'Associate Dean of Mess Affairs', 'None');
create type leave_status      as enum ('pending', 'approved', 'rejected');
create type attendance_status as enum ('present', 'absent');
create type exam_type         as enum ('internal', 'mid_term', 'final');

-- ---------- TABLES ---------------------------------------------------
create table public.courses (
  id          text primary key,                       -- e.g. CS101
  title       text not null,
  department  department_type not null,
  credits     int  not null default 3 check (credits between 1 and 6),
  semester    int  not null check (semester between 1 and 8),
  created_at  timestamptz not null default now()
);

create table public.mess_options (
  name text primary key
);

-- One table for all three roles. Role-specific columns are NULL for other roles.
create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  role                  user_role not null,
  name                  text not null,
  email                 text not null unique,
  phone_number          text,
  photo_url             text,
  signature_url         text,
  -- student + faculty
  department            department_type,
  -- student only
  branch                text,                          -- e.g. 'AI/DS' (students only)
  program               program_type,
  current_semester      int check (current_semester between 1 and 8),
  parent_phone_number   text,
  guardian_phone_number text,
  home_address          text,
  hostel_details        text,                          -- e.g. 'Hostel Y4, Room W310'
  mess_choice           text references public.mess_options(name) on update cascade on delete set null,
  -- faculty only (NO branch)
  designation           designation_type,
  additional_positions  position_type[] not null default '{None}',
  research_topics       text,
  education_history     jsonb not null default '[]'::jsonb,   -- [{degree, institution, year}]
  offered_courses       text[] not null default '{}',          -- course ids
  -- admin only
  role_title            text,
  created_at            timestamptz not null default now(),
  constraint role_fields_ok check (
    (role = 'student' and department is not null and program is not null and current_semester is not null)
    or (role = 'faculty' and department is not null and designation is not null
        and branch is null and program is null)
    or (role = 'admin')
  )
);
create index users_role_idx on public.users(role);

-- Global admin toggles
create table public.settings (
  key         text primary key,
  is_open     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.users(id) on delete set null
);

-- Security-question answers (hashed). No RLS policies => unreadable from the client.
create table public.security_answers (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  a1_hash         text not null,
  a2_hash         text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz
);

create table public.course_registrations (
  id          bigint generated always as identity primary key,
  student_id  uuid not null references public.users(id) on delete cascade,
  course_id   text not null references public.courses(id) on delete cascade,
  semester    int  not null check (semester between 1 and 8),
  created_at  timestamptz not null default now(),
  unique (student_id, course_id)
);

create table public.faculty_course_applications (
  id          bigint generated always as identity primary key,
  faculty_id  uuid not null references public.users(id) on delete cascade,
  course_id   text not null references public.courses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (faculty_id, course_id)
);

create table public.attendance (
  id              bigint generated always as identity primary key,
  student_id      uuid not null references public.users(id) on delete cascade,
  course_id       text not null references public.courses(id) on delete cascade,
  attendance_date date not null,
  status          attendance_status not null,
  marked_by       uuid references public.users(id) on delete set null,
  unique (student_id, course_id, attendance_date)
);

create table public.marks (
  id              bigint generated always as identity primary key,
  student_id      uuid not null references public.users(id) on delete cascade,
  course_id       text not null references public.courses(id) on delete cascade,
  exam            exam_type not null,
  marks_obtained  numeric(5,2) not null check (marks_obtained >= 0),
  max_marks       numeric(5,2) not null default 100 check (max_marks > 0),
  entered_by      uuid references public.users(id) on delete set null,
  unique (student_id, course_id, exam),
  check (marks_obtained <= max_marks)
);

create table public.leaves (
  id           bigint generated always as identity primary key,
  student_id   uuid not null references public.users(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  reason       text not null,
  status       leave_status not null default 'pending',
  reviewed_by  uuid references public.users(id) on delete set null,
  remarks      text,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------- HELPER FUNCTIONS (SECURITY DEFINER avoids RLS recursion) --
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false)
$$;

create or replace function public.is_faculty() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'faculty' from public.users where id = auth.uid()), false)
$$;

create or replace function public.is_student() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'student' from public.users where id = auth.uid()), false)
$$;

create or replace function public.my_offered_courses() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select offered_courses from public.users where id = auth.uid()), '{}')
$$;

create or replace function public.window_open(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_open from public.settings where key = p_key), false)
$$;

-- ---------- TRIGGERS -------------------------------------------------
-- Non-admins may only edit contact info, address, photos, signatures, research,
-- education, parent/guardian phones and mess choice. Everything else is locked.
create or replace function public.lock_protected_user_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() or current_setting('app.bypass_lock', true) = '1' then
    return new;
  end if;
  if new.id               is distinct from old.id
  or new.role             is distinct from old.role
  or new.email            is distinct from old.email
  or new.name             is distinct from old.name
  or new.department       is distinct from old.department
  or new.branch           is distinct from old.branch
  or new.program          is distinct from old.program
  or new.current_semester is distinct from old.current_semester
  or new.hostel_details   is distinct from old.hostel_details
  or new.designation      is distinct from old.designation
  or new.additional_positions is distinct from old.additional_positions
  or new.offered_courses  is distinct from old.offered_courses
  or new.role_title       is distinct from old.role_title
  then
    raise exception 'You are not allowed to change protected profile fields.';
  end if;
  return new;
end $$;

create trigger users_lock_protected before update on public.users
for each row execute function public.lock_protected_user_columns();

-- Keep users.offered_courses in sync with faculty_course_applications.
create or replace function public.sync_offered_courses() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.bypass_lock', '1', true);
  if tg_op = 'INSERT' then
    update public.users set offered_courses = array_append(offered_courses, new.course_id)
    where id = new.faculty_id and not (new.course_id = any(offered_courses));
  else
    update public.users set offered_courses = array_remove(offered_courses, old.course_id)
    where id = old.faculty_id;
  end if;
  perform set_config('app.bypass_lock', '', true);
  return null;
end $$;

create trigger fca_sync after insert or delete on public.faculty_course_applications
for each row execute function public.sync_offered_courses();

-- ---------- ROW LEVEL SECURITY ---------------------------------------
alter table public.users                       enable row level security;
alter table public.courses                     enable row level security;
alter table public.mess_options                enable row level security;
alter table public.settings                    enable row level security;
alter table public.security_answers            enable row level security;
alter table public.course_registrations        enable row level security;
alter table public.faculty_course_applications enable row level security;
alter table public.attendance                  enable row level security;
alter table public.marks                       enable row level security;
alter table public.leaves                      enable row level security;

-- users
create policy users_select_self on public.users for select to authenticated using (id = auth.uid());
create policy users_admin_all   on public.users for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy users_update_self on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_faculty_read_students on public.users for select to authenticated using (
  public.is_faculty() and role = 'student' and (
    exists (select 1 from public.course_registrations r
            where r.student_id = users.id and r.course_id = any(public.my_offered_courses()))
    or exists (select 1 from public.leaves l where l.student_id = users.id)
  )
);

-- reference data: readable by any signed-in user, writable by admin
create policy courses_read  on public.courses      for select to authenticated using (true);
create policy courses_admin on public.courses      for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mess_read     on public.mess_options for select to authenticated using (true);
create policy mess_admin    on public.mess_options for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_read  on public.settings    for select to authenticated using (true);
create policy settings_admin on public.settings    for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- course registrations (students, only while window is OPEN)
create policy reg_select_own     on public.course_registrations for select to authenticated using (student_id = auth.uid());
create policy reg_select_faculty on public.course_registrations for select to authenticated
  using (public.is_faculty() and course_id = any(public.my_offered_courses()));
create policy reg_insert_own     on public.course_registrations for insert to authenticated
  with check (student_id = auth.uid() and public.is_student() and public.window_open('registration_window_open'));
create policy reg_delete_own     on public.course_registrations for delete to authenticated
  using (student_id = auth.uid() and public.window_open('registration_window_open'));
create policy reg_admin          on public.course_registrations for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- faculty course applications (faculty, only while window is OPEN)
create policy fca_select_own on public.faculty_course_applications for select to authenticated using (faculty_id = auth.uid());
create policy fca_insert_own on public.faculty_course_applications for insert to authenticated
  with check (faculty_id = auth.uid() and public.is_faculty() and public.window_open('faculty_application_window_open'));
create policy fca_delete_own on public.faculty_course_applications for delete to authenticated
  using (faculty_id = auth.uid() and public.window_open('faculty_application_window_open'));
create policy fca_admin      on public.faculty_course_applications for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- attendance
create policy att_student_read on public.attendance for select to authenticated using (student_id = auth.uid());
create policy att_faculty_read on public.attendance for select to authenticated
  using (public.is_faculty() and course_id = any(public.my_offered_courses()));
create policy att_faculty_ins  on public.attendance for insert to authenticated
  with check (public.is_faculty() and course_id = any(public.my_offered_courses()) and marked_by = auth.uid());
create policy att_faculty_upd  on public.attendance for update to authenticated
  using (public.is_faculty() and course_id = any(public.my_offered_courses()))
  with check (public.is_faculty() and course_id = any(public.my_offered_courses()));
create policy att_admin        on public.attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- marks
create policy marks_student_read on public.marks for select to authenticated using (student_id = auth.uid());
create policy marks_faculty_read on public.marks for select to authenticated
  using (public.is_faculty() and course_id = any(public.my_offered_courses()));
create policy marks_faculty_ins  on public.marks for insert to authenticated
  with check (public.is_faculty() and course_id = any(public.my_offered_courses()) and entered_by = auth.uid());
create policy marks_faculty_upd  on public.marks for update to authenticated
  using (public.is_faculty() and course_id = any(public.my_offered_courses()))
  with check (public.is_faculty() and course_id = any(public.my_offered_courses()));
create policy marks_admin        on public.marks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leaves
create policy leaves_student_read on public.leaves for select to authenticated using (student_id = auth.uid());
create policy leaves_student_ins  on public.leaves for insert to authenticated
  with check (student_id = auth.uid() and public.is_student() and status = 'pending');
create policy leaves_student_del   on public.leaves for delete to authenticated using (student_id = auth.uid() and status = 'pending');
create policy leaves_faculty_read on public.leaves for select to authenticated using (public.is_faculty());
create policy leaves_faculty_upd  on public.leaves for update to authenticated using (public.is_faculty()) with check (public.is_faculty());
create policy leaves_admin        on public.leaves for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- RPC FUNCTIONS --------------------------------------------
-- Set/replace the caller's two security answers (case-insensitive, trimmed, hashed).
create or replace function public.set_security_answers(p_a1 text, p_a2 text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(trim(coalesce(p_a1,''))) = 0 or length(trim(coalesce(p_a2,''))) = 0 then
    raise exception 'Both answers are required';
  end if;
  insert into public.security_answers (user_id, a1_hash, a2_hash)
  values (auth.uid(),
          extensions.crypt(lower(trim(p_a1)), extensions.gen_salt('bf')),
          extensions.crypt(lower(trim(p_a2)), extensions.gen_salt('bf')))
  on conflict (user_id) do update
    set a1_hash = excluded.a1_hash, a2_hash = excluded.a2_hash,
        failed_attempts = 0, locked_until = null;
end $$;

-- Forgot-password: verifies both answers, then sets a new password.
-- Returns true/false only (never reveals whether the email exists). 5 misses => 15 min lock.
create or replace function public.reset_password_with_security(
  p_email text, p_a1 text, p_a2 text, p_new_password text) returns boolean
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_uid uuid;
  v_row public.security_answers%rowtype;
begin
  select id into v_uid from public.users where email = lower(trim(p_email));
  if v_uid is null then return false; end if;
  select * into v_row from public.security_answers where user_id = v_uid;
  if not found then return false; end if;
  if v_row.locked_until is not null and v_row.locked_until > now() then return false; end if;

  if extensions.crypt(lower(trim(coalesce(p_a1,''))), v_row.a1_hash) = v_row.a1_hash
     and extensions.crypt(lower(trim(coalesce(p_a2,''))), v_row.a2_hash) = v_row.a2_hash then
    if length(coalesce(p_new_password,'')) < 8 then return false; end if;
    update auth.users
       set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
           updated_at = now()
     where id = v_uid;
    update public.security_answers set failed_attempts = 0, locked_until = null where user_id = v_uid;
    return true;
  end if;

  update public.security_answers
     set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
   where user_id = v_uid;
  return false;
end $$;

-- Admin-only: remove a login + profile (cascades to all related rows).
create or replace function public.admin_delete_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot delete your own account'; end if;
  delete from auth.users where id = p_user_id;
end $$;

revoke execute on function public.set_security_answers(text, text)                 from public, anon;
revoke execute on function public.admin_delete_user(uuid)                          from public, anon;
grant  execute on function public.set_security_answers(text, text)                 to authenticated;
grant  execute on function public.admin_delete_user(uuid)                          to authenticated;
grant  execute on function public.reset_password_with_security(text, text, text, text) to anon, authenticated;

-- ---------- STORAGE (profile photos + signatures) --------------------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true), ('signatures', 'signatures', true)
on conflict (id) do nothing;

create policy "profile images public read" on storage.objects for select
  using (bucket_id in ('avatars', 'signatures'));
create policy "profile images insert own" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'signatures')
              and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "profile images update own" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'signatures')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "profile images delete own" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'signatures')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- SEED DATA ------------------------------------------------
insert into public.settings (key, is_open) values
  ('registration_window_open', false),
  ('faculty_application_window_open', false);

insert into public.mess_options (name) values ('Mess A'), ('Mess B'), ('Mess C (Veg)');

insert into public.courses (id, title, department, credits, semester) values
  ('CS101', 'Introduction to Programming',   'Computer Science & Engineering', 4, 1),
  ('CS201', 'Data Structures',               'Computer Science & Engineering', 4, 3),
  ('CS301', 'Database Systems',              'Computer Science & Engineering', 3, 5),
  ('EE101', 'Basic Electrical Engineering',  'Electrical Engineering',         3, 1),
  ('EE201', 'Signals and Systems',           'Electrical Engineering',         4, 3),
  ('ME101', 'Engineering Mechanics',         'Mechanical Engineering',         3, 1),
  ('ME201', 'Thermodynamics',                'Mechanical Engineering',         4, 3),
  ('CE101', 'Surveying',                     'Civil Engineering',              3, 1),
  ('MA101', 'Calculus',                      'Basic Sciences',                 4, 1),
  ('PH101', 'Engineering Physics',           'Basic Sciences',                 3, 2);

-- ---------- BOOTSTRAP THE FIRST ADMIN (do once) ----------------------
-- 1) Dashboard > Authentication > Users > "Add user": email + password (tick "Auto Confirm User").
-- 2) Copy that user's UUID, then run (replace the 3 placeholders):
--
-- insert into public.users (id, role, name, email, role_title)
-- values ('<UUID>', 'admin', 'College Admin', '<admin email>', 'System Administrator');
--
-- insert into public.security_answers (user_id, a1_hash, a2_hash) values (
--   '<UUID>',
--   extensions.crypt(lower('<mother maiden name>'), extensions.gen_salt('bf')),
--   extensions.crypt(lower('<high school name>'),   extensions.gen_salt('bf')));