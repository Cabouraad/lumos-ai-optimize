-- Clean up generic terms wrongly added as competitors
DELETE FROM brand_catalog 
WHERE is_org_brand = false
AND LOWER(name) IN (
  'make', 'used car', 'used cars', 'online car', 'car', 'cars', 'auto', 'dealer', 'vehicle', 'vehicles',
  'new car', 'new cars', 'buy car', 'sell car', 'car dealer', 'car dealership',
  'price', 'pricing', 'best', 'top', 'buy', 'sell', 'find', 'search', 'compare',
  'option', 'options', 'review', 'reviews', 'rating', 'ratings', 'deal', 'deals'
);

-- Also delete any competitor entry that matches the org's own name
DELETE FROM brand_catalog bc
USING organizations o
WHERE bc.org_id = o.id
AND bc.is_org_brand = false
AND LOWER(TRIM(bc.name)) = LOWER(TRIM(o.name));

-- Delete any competitor entry that matches an existing org brand entry for the same org
DELETE FROM brand_catalog bc
WHERE bc.is_org_brand = false
AND EXISTS (
  SELECT 1 FROM brand_catalog ob
  WHERE ob.org_id = bc.org_id
  AND ob.is_org_brand = true
  AND LOWER(TRIM(ob.name)) = LOWER(TRIM(bc.name))
);