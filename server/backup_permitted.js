const { Pool } = require('pg');
const fs = require('fs');
(async ()=>{
  const p = new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
  try{
    const r=await p.query("SELECT json_agg(t) as arr FROM permitted_accounts t WHERE role='student'");
    const out=r.rows[0].arr||[];
    const fn='/home/user/software4infotuanwei/data/permitted_accounts_backup_'+Date.now()+'.json';
    fs.writeFileSync(fn, JSON.stringify(out, null, 2));
    console.log('backup written', fn, 'rows', out.length);
  }catch(e){
    console.error('ERR', e.message); process.exit(2);
  }finally{await p.end();}
})();
