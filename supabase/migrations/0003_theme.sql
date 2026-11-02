-- Each account's light/dark preference, editable by its owner.
alter table public.profiles add column theme text not null default 'light' check (theme in ('light', 'dark', 'system'));
grant update (theme) on public.profiles to authenticated;
