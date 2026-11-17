-- Local test of setup.sql, emulating Supabase roles (anon, authenticated) and the extensions schema.
\set ON_ERROR_STOP on
set role anon;
-- Direct table access must be denied
do $$ begin
  begin perform * from public.tuberias_rooms; raise exception 'FAIL: anon can read table';
  exception when insufficient_privilege then raise notice 'OK: anon cannot read the table'; end;
  begin insert into public.tuberias_rooms(code, edit_key_hash, state) values ('AAAAAA','x','{}'); raise exception 'FAIL: anon can insert';
  exception when insufficient_privilege then raise notice 'OK: anon cannot insert'; end;
end $$;

create temp table t as select * from public.tuberias_create_room('{"app":"tuberias","name":"Test","team":"Red","listed":true,"stages":[]}'::jsonb);
select room_code ~ '^[A-Z0-9]{6}$' as code_ok, length(edit_key) = 36 as key_ok from t;
select (select room_code from t) as code \gset
select (select edit_key from t) as key \gset

select room_code = :'code' as get_ok, state->>'name' as name, listed from public.tuberias_get_room(lower(:'code'));
select public.tuberias_save_room(:'code', :'key', '{"app":"tuberias","name":"Renamed","listed":false}'::jsonb) is not null as save_ok;
select state->>'name' = 'Renamed' as saved_name_ok, listed = false as unlisted_ok from public.tuberias_get_room(:'code');
select public.tuberias_check_key(:'code', :'key') as key_valid, public.tuberias_check_key(:'code', 'nope') as wrong_key_valid;

do $$ begin
  begin perform public.tuberias_save_room((select room_code from t), 'wrong-key', '{"x":1}'::jsonb); raise exception 'FAIL: wrong key saved';
  exception when raise_exception then
    if sqlerrm like 'not allowed%' then raise notice 'OK: wrong key rejected'; else raise; end if; end;
  begin perform public.tuberias_create_room(jsonb_build_object('big', repeat('x', 500000))); raise exception 'FAIL: big state accepted';
  exception when raise_exception then
    if sqlerrm = 'state too large' then raise notice 'OK: big state rejected'; else raise; end if; end;
  begin perform public.tuberias_create_room('[1,2]'::jsonb); raise exception 'FAIL: array accepted';
  exception when raise_exception then
    if sqlerrm = 'invalid state' then raise notice 'OK: non-object rejected'; else raise; end if; end;
end $$;

-- Lobby: listed rooms only
select count(*) as listed_before from public.tuberias_list_rooms() where room_code = :'code';
select public.tuberias_save_room(:'code', :'key', '{"app":"tuberias","name":"Listed","team":"Red","scenarioId":"s-ai-ds","listed":true}'::jsonb) is not null;
select room_code = :'code' as in_lobby, name, team, scenario_id from public.tuberias_list_rooms() where room_code = :'code';
reset role;
\echo ALL SQL TESTS PASSED
