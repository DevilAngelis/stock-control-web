import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query("SELECT NOW()")
  .then(res => {
    console.log("Conectado com sucesso!");
    console.log(res.rows);
  })
  .catch(err => {
    console.error("Erro na conexão:", err);
  });
