-- 05 - Schedule warning queues and Second Life delivery processor.

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'love-potion-queue-warning-notifications'
  ) then
    perform cron.unschedule('love-potion-queue-warning-notifications');
  end if;

  if exists (
    select 1
    from cron.job
    where jobname = 'love-potion-process-second-life-notifications'
  ) then
    perform cron.unschedule('love-potion-process-second-life-notifications');
  end if;
end;
$$;

select cron.schedule(
  'love-potion-queue-warning-notifications',
  '10 9 * * *',
  $$select * from public.queue_warning_notifications();$$
);

select cron.schedule(
  'love-potion-process-second-life-notifications',
  '*/10 * * * *',
  $$select public.process_due_second_life_notifications();$$
);
