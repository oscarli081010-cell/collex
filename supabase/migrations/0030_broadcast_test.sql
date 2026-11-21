-- "Send Me a Test": an organiser can email a draft broadcast to themself before sending it to the group.
-- It follows the same permission and wording rules as send_broadcast, queues one email to the caller only, and is not
-- recorded in public.broadcasts, so it never shows in the sent history or counts toward the five a day.

create function public.send_broadcast_test(conf uuid, mail_subject text, mail_body text) returns text
language plpgsql security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); addr text; subj text := trim(coalesce(mail_subject, '')); txt text := trim(coalesce(mail_body, ''));
begin
  if me is null or not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t send email for this conference' using errcode = '42501'; end if;
  if char_length(subj) < 3 or char_length(subj) > 120 or char_length(txt) < 10 or char_length(txt) > 3000 then
    raise exception 'Write a subject (3 to 120 characters) and a message (10 to 3,000)' using errcode = '22023';
  end if;
  -- Tests have a limit of their own. The outbox has no column for the kind of email, so they are found by the "[Test] " subject.
  if (select count(*) from private.mail where to_user = me and subject like '[Test] %' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You can send ten test emails an hour. Try again a little later' using errcode = '54000';
  end if;
  select name, slug into c from public.conferences where id = conf;
  if not found then raise exception 'That conference no longer exists' using errcode = '22023'; end if;
  select email into addr from auth.users where id = me;
  if addr is null then raise exception 'Your account has no email address' using errcode = '22023'; end if;
  perform private.send_mail(me, '[Test] ' || c.name || ': ' || subj, subj, txt, 'https://collex.au/conferences/' || c.slug, 'Open the conference',
    'This is a test you sent to yourself from the ' || c.name || ' organiser page on Collex. Nobody else got it.', null);
  return addr;
end $$;

revoke execute on function public.send_broadcast_test(uuid, text, text) from public, anon;
grant execute on function public.send_broadcast_test(uuid, text, text) to authenticated;
