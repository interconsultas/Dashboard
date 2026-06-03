const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://ips_user:dev_local_2026@127.0.0.1:5432/interconsultas_dev' }); 
c.connect()
  .then(() => c.query("SELECT count(DISTINCT diagnostico_desc) FROM autorizaciones"))
  .then(r => console.log(r.rows[0]))
  .finally(() => c.end())
  .catch(console.error);
