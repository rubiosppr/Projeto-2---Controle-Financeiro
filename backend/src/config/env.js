import 'dotenv/config';

const teste = process.env.NODE_ENV === 'test';

export const env = {
  porta: Number(process.env.PORT ?? 3000),
  databaseUrl: teste ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpira: process.env.JWT_EXPIRA ?? '1h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  teste,
};

if (!env.databaseUrl || !env.jwtSecret) {
  throw new Error('Variáveis de ambiente ausentes: configure DATABASE_URL e JWT_SECRET no .env');
}
