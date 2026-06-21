select 'audit_logs' as table_name, count(*) as rows_to_delete
from public.audit_logs
union all
select 'notification_queue_second_life' as table_name, count(*) as rows_to_delete
from public.notification_queue
where channel = 'second_life';
