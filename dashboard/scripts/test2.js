const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://ips_user:dev_local_2026@127.0.0.1:5432/interconsultas_dev' }); 
c.connect()
  .then(() => c.query("SELECT * FROM vm_resumen_dimensiones LIMIT 1"))
  .then(r => console.log(Object.keys(r.rows[0])))
  .finally(() => c.end())
  .catch(console.error);
