const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://ips_user:dev_local_2026@127.0.0.1:5432/interconsultas_dev' }); 
c.connect()
  .then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
  .then(r => console.log(r.rows.map(row => row.table_name)))
  .finally(() => c.end())
  .catch(console.error);
