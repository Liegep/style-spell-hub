-- Preserve one row per Second Life delivery object instead of overwriting a single "primary" record.

update public.second_life_delivery_servers current_row
set id = current_row.object_key
where current_row.id = 'primary'
  and current_row.object_key is not null
  and not exists (
    select 1
    from public.second_life_delivery_servers existing_row
    where existing_row.id = current_row.object_key
  );

alter table public.second_life_delivery_servers
alter column id drop default;
