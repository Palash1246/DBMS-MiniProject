-- ParkSmart query catalog. Replace $n parameters with values or bind via pg.

-- Q1: Customer history (joins, left join, ordering, limit)
SELECT b.booking_id,b.booking_code,b.status,b.start_time,b.end_time,b.amount,
       v.reg_number,v.vehicle_type,s.slot_label,l.name AS lot_name,a.name AS locality,
       p.status AS payment_status,p.method,p.paid_at
FROM bookings b JOIN users u USING(user_id) JOIN vehicles v USING(vehicle_id)
JOIN slots s USING(slot_id) JOIN parking_lots l USING(lot_id) JOIN areas a USING(area_id)
LEFT JOIN payments p USING(booking_id)
WHERE u.user_id=$1 ORDER BY b.created_at DESC LIMIT 50;

-- Q2: Lots above a revenue threshold over the last 30 days (GROUP BY, HAVING)
SELECT l.lot_id,l.name,SUM(p.amount) AS revenue
FROM parking_lots l JOIN slots s USING(lot_id) JOIN bookings b USING(slot_id)
JOIN payments p USING(booking_id)
WHERE p.status='success' AND p.paid_at>=now()-INTERVAL '30 days'
GROUP BY l.lot_id,l.name HAVING SUM(p.amount)>$1 ORDER BY revenue DESC;

-- Q3: Nested subquery: bookings by customers who own an EV vehicle
SELECT booking_id,booking_code,user_id,start_time,status
FROM bookings WHERE user_id IN (SELECT user_id FROM vehicles WHERE vehicle_type='ev')
ORDER BY start_time DESC;

-- Q4: Correlated subquery: bookings above their own lot's mean booking amount
SELECT b.booking_id,l.name,b.amount
FROM bookings b JOIN slots s USING(slot_id) JOIN parking_lots l USING(lot_id)
WHERE b.amount>(SELECT AVG(b2.amount) FROM bookings b2 JOIN slots s2 USING(slot_id) WHERE s2.lot_id=l.lot_id)
ORDER BY b.amount DESC;

-- Q5: Recursive area subtree with depth and readable path
WITH RECURSIVE tree AS (
  SELECT area_id,name,level,parent_area_id,0 AS depth,name::text AS path FROM areas WHERE area_id=$1
  UNION ALL
  SELECT a.area_id,a.name,a.level,a.parent_area_id,t.depth+1,t.path||' > '||a.name
  FROM areas a JOIN tree t ON a.parent_area_id=t.area_id
) SELECT * FROM tree ORDER BY path;

-- Q6: Revenue ranking within each locality (CTE and window function)
WITH lot_revenue AS (
  SELECT l.lot_id,l.area_id,l.name,COALESCE(SUM(p.amount) FILTER(WHERE p.status='success'),0) AS revenue
  FROM parking_lots l LEFT JOIN slots s USING(lot_id) LEFT JOIN bookings b USING(slot_id)
  LEFT JOIN payments p USING(booking_id) GROUP BY l.lot_id
) SELECT a.name AS locality,r.name AS lot_name,r.revenue,
         RANK() OVER(PARTITION BY r.area_id ORDER BY r.revenue DESC) AS area_rank
  FROM lot_revenue r JOIN areas a USING(area_id) ORDER BY locality,area_rank;

-- Q7: Free active slots for a requested time window (NOT EXISTS)
SELECT s.slot_id,s.slot_label,s.slot_type
FROM slots s JOIN parking_lots l USING(lot_id)
WHERE s.lot_id=$1 AND s.status='active' AND l.is_active
AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.slot_id=s.slot_id AND b.status IN('held','confirmed')
  AND tstzrange(b.start_time,b.end_time,'[)')&&tstzrange($2::timestamptz,$3::timestamptz,'[)'))
ORDER BY s.slot_label;

-- Q8: Peak start hour per lot (DISTINCT ON)
SELECT DISTINCT ON(lot_id) lot_id,lot_name,hour_of_day,booking_count
FROM v_peak_hours ORDER BY lot_id,booking_count DESC,hour_of_day;

-- Q9: Customers with bookings but no completed visit (EXISTS and NOT EXISTS)
SELECT u.user_id,u.name,u.email FROM users u
WHERE u.role='customer' AND EXISTS(SELECT 1 FROM bookings b WHERE b.user_id=u.user_id)
AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.user_id=u.user_id AND b.status='completed');

-- Q10: Lots that have spaces but no EV space (EXCEPT)
SELECT lot_id FROM slots
EXCEPT SELECT lot_id FROM slots WHERE slot_type='ev';

-- Q11: Average rating for lots with at least three reviews
SELECT l.lot_id,l.name,AVG(r.rating)::numeric(3,2) AS avg_rating,COUNT(*) AS reviews
FROM parking_lots l JOIN reviews r USING(lot_id)
GROUP BY l.lot_id,l.name HAVING COUNT(*)>=3 ORDER BY avg_rating DESC;

-- Q12: Admin rate adjustment for lots whose live occupancy exceeds 85 percent
UPDATE parking_lots l SET base_rate_per_hr=ROUND(base_rate_per_hr*1.10,2)
WHERE l.lot_id IN (
  SELECT o.lot_id FROM v_lot_occupancy o
  WHERE o.total_slots>0 AND o.occupancy_pct>85
);

-- Q13: Delete a slot only if it has no future active booking
DELETE FROM slots s WHERE s.slot_id=$1
AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.slot_id=s.slot_id
  AND b.status IN('held','confirmed') AND b.end_time>now());

-- Q14: Generate a batch of regular spaces for one lot
INSERT INTO slots(lot_id,slot_label,slot_type)
SELECT $1,'S'||lpad(n::text,2,'0'),'regular' FROM generate_series(1,$2) n;
