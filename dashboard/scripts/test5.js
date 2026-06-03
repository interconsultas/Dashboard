const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://ips_user:dev_local_2026@127.0.0.1:5432/interconsultas_dev' }); 
c.connect()
  .then(() => c.query("SELECT diagnostico_desc AS diag FROM autorizaciones WHERE diagnostico_desc IS NOT NULL GROUP BY diagnostico_desc ORDER BY COUNT(*) DESC LIMIT 50"))
  .then(r => console.log(r.rows.length))
  .finally(() => c.end())
  .catch(console.error);
