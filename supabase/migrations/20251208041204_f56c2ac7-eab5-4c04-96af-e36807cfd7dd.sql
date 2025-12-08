-- Clear ALL cached scores for the affected org to force fresh computation with brand filtering
DELETE FROM llumos_scores 
WHERE org_id = '4d1d9ebb-d13e-4094-99c8-e74fe8526239';