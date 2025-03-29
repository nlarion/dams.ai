select domelement as text, 'ads' as label
from urls.ads
where id not in (1, 2, 7)
UNION
select domelement as text, 'not ads' as label
from urls.notads