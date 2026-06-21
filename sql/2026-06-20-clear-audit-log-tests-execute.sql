delete from public.audit_logs;

delete from public.notification_queue
where channel = 'second_life';
