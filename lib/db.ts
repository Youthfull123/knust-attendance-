import {Pool} from 'pg';
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes('neon')?{rejectUnauthorized:false}:undefined});
const SCHEMA=`
create table if not exists venues(id serial primary key,name text unique not null,lat float8 not null,lng float8 not null,radius int not null default 60);
create table if not exists users(id serial primary key,email text unique not null,name text,pass text not null,role text not null default 'lecturer');
create table if not exists courses(id serial primary key,lecturer_id int references users(id),code text not null,title text);
create table if not exists enrolments(course_id int references courses(id) on delete cascade,student_id text,primary key(course_id,student_id));
create table if not exists sessions(id uuid primary key default gen_random_uuid(),course_id int references courses(id),venue_id int references venues(id),radius int,secret text not null,status text default 'active',started_at timestamptz default now(),ends_at timestamptz);
create table if not exists attendance(id serial primary key,session_id uuid references sessions(id),student_id text not null,status text not null,reason text,dist float8,acc float8,face float8[],created_at timestamptz default now());
create unique index if not exists one_accepted on attendance(session_id,student_id) where status='accepted';`;
let ready:Promise<any>|null=null;
export const q=async(s:string,a:any[]=[])=>{ready??=p.query(SCHEMA);await ready;return (await p.query(s,a)).rows};
