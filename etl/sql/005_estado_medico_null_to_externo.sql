-- Reemplazar NULL en estado_medico por 'EXTERNO'
-- para simplificar filtros (elimina la logica especial de IS NULL)

BEGIN;

UPDATE autorizaciones
   SET estado_medico = 'EXTERNO'
 WHERE estado_medico IS NULL;

-- Refrescar vista materializada para que refleje el cambio
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_filtros_dashboard;

COMMIT;
