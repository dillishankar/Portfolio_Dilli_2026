-- ============================================================================
--  PORTFOLIO ADMIN PANEL — DATABASE SETUP (Supabase / PostgreSQL)
--
--  HOW TO USE (details in SETUP_ADMIN.md):
--    1. Supabase Dashboard → Authentication → Users → "Add user" (your email + a strong password)
--    2. Supabase Dashboard → SQL Editor → paste this whole file → Run
--    3. It is safe to run again later (it never deletes your data).
--
--  SECURITY MODEL
--    • Visitors (anonymous)  : can READ public content, can SEND a contact message. Nothing else.
--    • You (admin)           : the only account allowed to add / edit / delete anything,
--                              and the only one who can READ contact messages.
--    • Enforced by Row Level Security inside the database, so it cannot be bypassed from
--      the browser — hiding the admin page is NOT what protects your data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. YOUR ADMIN EMAIL  (change here if you use a different login email)
-- ---------------------------------------------------------------------------
create or replace function public._admin_email() returns text
language sql immutable as $$ select 'dillishankar.k30@gmail.com'::text $$;

-- ---------------------------------------------------------------------------
-- 1. ADMINS — who is allowed to manage the site
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
    user_id uuid primary key
);
alter table public.admins enable row level security;
-- (no policies on purpose: nobody can read or change this table through the API)

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
    key        text primary key check (char_length(key) <= 60),
    value      jsonb not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.projects (
    id          uuid primary key default gen_random_uuid(),
    title       text not null check (char_length(title) between 1 and 120),
    description text not null default '' check (char_length(description) <= 600),
    tags        text[] not null default '{}' check (cardinality(tags) <= 6),
    image_url   text not null default '' check (char_length(image_url) <= 600),
    link_url    text not null default '' check (char_length(link_url) <= 600),
    link_label  text not null default 'View Project' check (char_length(link_label) <= 40),
    sort_order  integer not null default 0,
    created_at  timestamptz not null default now()
);

create table if not exists public.certificates (
    id         uuid primary key default gen_random_uuid(),
    title      text not null check (char_length(title) between 1 and 120),
    image_url  text not null check (char_length(image_url) between 1 and 600),
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.skills (
    id         uuid primary key default gen_random_uuid(),
    name       text not null check (char_length(name) between 1 and 40),
    icon_url   text not null check (char_length(icon_url) between 1 and 600),
    icon_style text not null default 'original' check (icon_style in ('original', 'invert', 'white')),
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.messages (
    id         uuid primary key default gen_random_uuid(),
    name       text not null default '' check (char_length(name) <= 120),
    email      text not null check (char_length(email) <= 254
                                     and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    message    text not null default '' check (char_length(message) <= 2000),
    is_read    boolean not null default false,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. PERMISSIONS + ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.settings     enable row level security;
alter table public.projects     enable row level security;
alter table public.certificates enable row level security;
alter table public.skills       enable row level security;
alter table public.messages     enable row level security;

-- start from nothing, then grant exactly what is needed
revoke all on public.settings, public.projects, public.certificates, public.skills, public.messages
    from anon, authenticated;

grant select on public.settings, public.projects, public.certificates, public.skills to anon, authenticated;
grant insert, update, delete on public.settings, public.projects, public.certificates, public.skills to authenticated;

grant insert on public.messages to anon, authenticated;           -- visitors can send…
grant select, update, delete on public.messages to authenticated; -- …only the admin can read / manage

-- public content: everyone reads, only admin writes
do $$
declare t text;
begin
    foreach t in array array['settings', 'projects', 'certificates', 'skills'] loop
        execute format('drop policy if exists %I on public.%I', t || '_read',   t);
        execute format('drop policy if exists %I on public.%I', t || '_insert', t);
        execute format('drop policy if exists %I on public.%I', t || '_update', t);
        execute format('drop policy if exists %I on public.%I', t || '_delete', t);

        execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
        execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_insert', t);
        execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
        execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_delete', t);
    end loop;
end $$;

-- messages: anyone may INSERT (unread only); only admin may read / update / delete
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_read   on public.messages;
drop policy if exists messages_update on public.messages;
drop policy if exists messages_delete on public.messages;

create policy messages_insert on public.messages for insert to anon, authenticated
    with check (is_read = false);
create policy messages_read   on public.messages for select to authenticated using (public.is_admin());
create policy messages_update on public.messages for update to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy messages_delete on public.messages for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. FILE STORAGE (project images, certificates, skill icons, resume)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media', 'portfolio-media', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf'])
on conflict (id) do update
    set public = true,
        file_size_limit = 10485760,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf'];

drop policy if exists portfolio_media_read   on storage.objects;
drop policy if exists portfolio_media_insert on storage.objects;
drop policy if exists portfolio_media_update on storage.objects;
drop policy if exists portfolio_media_delete on storage.objects;

create policy portfolio_media_read   on storage.objects for select to anon, authenticated
    using (bucket_id = 'portfolio-media');
create policy portfolio_media_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'portfolio-media' and public.is_admin());
create policy portfolio_media_update on storage.objects for update to authenticated
    using (bucket_id = 'portfolio-media' and public.is_admin())
    with check (bucket_id = 'portfolio-media' and public.is_admin());
create policy portfolio_media_delete on storage.objects for delete to authenticated
    using (bucket_id = 'portfolio-media' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. MAKE YOUR ACCOUNT THE ADMIN
--    (needs the user from step 1 to exist; re-run this file after creating it if you see the notice)
-- ---------------------------------------------------------------------------
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower(public._admin_email())
on conflict do nothing;

do $$
begin
    if not exists (select 1 from public.admins) then
        raise notice 'NO ADMIN YET: create the user % in Authentication → Users, then run this file again.',
            public._admin_email();
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. STARTING CONTENT — exactly what the portfolio shows today
--    (only inserted when a table is empty, so re-running never duplicates or overwrites)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
    ('availability', jsonb_build_object(
        'available',   true,
        'badge_text',  'Available for work',
        'banner_text', 'AVAILABLE FOR Q3/Q4 2026 FULL-TIME ROLES & PROJECTS')),
    ('about', jsonb_build_object('texts', jsonb_build_array(
        'I am a motivated and enthusiastic Data Analyst with a strong foundation in data processing, SQL, and analytical thinking.',
        'I build structured data solutions and turn raw information into meaningful insights.',
        'I also have experience in Digital Marketing, with a strong understanding of online strategies and user engagement.',
        'I enjoy leveraging data and technology to support impactful business decisions.'))),
    ('profile', jsonb_build_object(
        'email',    'dillishankar.k30@gmail.com',
        'whatsapp', '918825858292',
        'github',   'https://github.com',
        'linkedin', 'https://linkedin.com')),
    ('resume', jsonb_build_object('url', 'assets/Dillishankar.k-DA-Resume.pdf'))
on conflict (key) do nothing;

insert into public.projects (title, description, tags, image_url, link_url, link_label, sort_order)
select * from (values
    ('Object Detection',
     'Computer vision project focused on detecting objects from images and video using modern deep learning techniques.',
     array['PYTHON', 'YOLO', 'OPENCV'], 'assets/images/projects/elt-project.png', 'https://elt-pipeline.netlify.app/', 'View Project', 10),
    ('Calorie Checker',
     'A simple web experience designed to help users check and understand calorie information through an intuitive interface.',
     array['PYTHON', 'FLASK', 'WEB'], 'assets/images/projects/project1.jpeg', '', 'View Project', 20),
    ('SheCare',
     'A user-focused mobile experience designed around accessibility, usability and thoughtful interaction design.',
     array['UI/UX', 'FIGMA', 'RESEARCH'], 'assets/images/projects/project2.png', '', 'View Case Study', 30),
    ('Adaptive Workspace',
     'A modern workspace concept focused on creating flexible and intuitive digital experiences.',
     array['UI/UX', 'FIGMA', 'PROTOTYPE'], 'assets/images/projects/project2.png', '', 'View Project', 40),
    ('Hotel Booking',
     'A responsive hotel booking interface focused on clean layouts, responsive design and straightforward user interaction.',
     array['HTML', 'CSS', 'BOOTSTRAP'], 'assets/images/projects/project3.png', '', 'View Project', 50),
    ('Data Analytics',
     'An analytics project focused on transforming raw information into useful insights, visualizations and business decisions.',
     array['SQL', 'PANDAS', 'POWER BI'], 'assets/images/projects/project4.png', '', 'View Dashboard', 60)
) as seed(title, description, tags, image_url, link_url, link_label, sort_order)
where not exists (select 1 from public.projects);

insert into public.certificates (title, image_url, sort_order)
select * from (values
    ('Certificate 01', 'assets/images/certificate/certificate1.jpeg', 10),
    ('Certificate 02', 'assets/images/certificate/certificate2.jpeg', 20),
    ('Certificate 03', 'assets/images/certificate/certificate3.jpeg', 30),
    ('Certificate 04', 'assets/images/certificate/certificate4.jpg',  40),
    ('Certificate 05', 'assets/images/certificate/certificate1.jpeg', 50)
) as seed(title, image_url, sort_order)
where not exists (select 1 from public.certificates);

-- Skills are shown in two scrolling columns: odd positions go left, even positions go right.
insert into public.skills (name, icon_url, icon_style, sort_order)
select * from (values
    ('React',      'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',                                 'original',  10),
    ('Django',     'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg',                                  'invert',    20),
    ('JavaScript', 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',                       'original',  30),
    ('MySQL',      'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg',                                 'white',     40),
    ('HTML5',      'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg',                                 'original',  50),
    ('CSS3',       'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg',                                   'original',  60),
    ('Figma',      'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg',                                 'original',  70),
    ('Git',        'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg',                                     'original',  80),
    ('Python',     'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',                               'original',  90),
    ('Bootstrap',  'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bootstrap/bootstrap-original.svg',                         'original', 100),
    ('Excel',      'assets/icons/excel.svg',                                                                                      'original', 110),
    ('AWS',        'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg',   'invert',   120),
    ('Power BI',   'assets/icons/powerbi.svg',                                                                                    'original', 130)
) as seed(name, icon_url, icon_style, sort_order)
where not exists (select 1 from public.skills);
