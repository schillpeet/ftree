UPDATE families
SET name = 'default'
WHERE lower(name) = lower('Familie 1')
  AND NOT EXISTS (SELECT 1 FROM families WHERE lower(name) = 'default');
