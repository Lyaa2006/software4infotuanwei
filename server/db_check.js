const { Pool } = require('pg');
(async ()=>{
  try{
    const p = new Pool({host:process.env.DB_HOST, port:process.env.DB_PORT, user:process.env.DB_USER, password:process.env.DB_PASSWORD, database:process.env.DB_NAME});
    const res = await p.query("SELECT count(*) AS c FROM information_schema.tables WHERE table_name='permitted_accounts'");
    console.log('has_table', res.rows[0].c);
    if (Number(res.rows[0].c) > 0) {
      const r2 = await p.query("SELECT count(*) AS c FROM permitted_accounts WHERE role='student'");
      console.log('student_count_before', r2.rows[0].c);
    }
    await p.end();
  }catch(e){
    console.error('ERR', e.message);
    process.exit(2);
  }
})();
