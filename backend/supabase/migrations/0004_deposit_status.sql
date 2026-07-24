-- 'deposit_paid' — a €20 deposit has been paid to secure a pay-in-person
-- booking, with the remainder due at the session. Distinct from 'paid'
-- (full amount collected) and 'unpaid' (nothing collected yet).
alter table appointments drop constraint appointments_pay_status_check;
alter table appointments add constraint appointments_pay_status_check
  check (pay_status in ('paid', 'unpaid', 'deposit_paid'));
