import { verificar } from '../config/jwt.js';

export function autenticar(req, res, next) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }
  try {
    const payload = verificar(token);
    req.usuarioId = Number(payload.sub);
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}
