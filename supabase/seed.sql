-- Test vehicles for Prototype v0. Fake plates; no real vehicle or person is described.
-- Safe to run more than once. Contains no secrets.

insert into public.vehicles (vehicle_id, plate, route_id, active) values
  ('R4-TEST-01', 'TEST 001', 'R4', true),
  ('R4-TEST-02', 'TEST 002', 'R4', true),
  -- Inactive on purpose: used to test that clients cannot read inactive vehicles
  ('R4-TEST-OFF', 'TEST 000', 'R4', false)
on conflict (vehicle_id) do update
  set plate = excluded.plate, route_id = excluded.route_id, active = excluded.active;
