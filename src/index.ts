import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pkg from 'pg'
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config()
const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Clave secreta para JWT (debes guardarla en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro';

// Middleware para verificar token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

const app = express()

app.use(express.json())

app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Express on Vercel</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/tareas">Tareas (DB)</a>
        </nav>
        <h1>Welcome to Express on Vercel 🚀</h1>
        <p>This is a minimal example with database integration.</p>
        <img src="/logo.png" alt="Logo" width="120" />
      </body>
    </html>
  `)
})

app.get('/about', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'components', 'about.htm'))
})

app.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usuarios')
    res.json(result.rows)
  } catch (err) {
    console.error('Error al consultar la base de datos:', err)
    res.status(500).json({ error: 'Error al consultar la base de datos' })
  }
})

// post que crea un nuevo usuario en la base de datos
app.post('/usuarios', express.json(), async (req, res) => {
  const { nombre, correo, boleta, carrera, password } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, correo, boleta, carrera, password)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, correo, boleta, carrera, password]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Error al insertar en la base de datos:', err)
    res.status(500).json({ error: 'Error al insertar en la base de datos' })
  }
})

// post que me permite verificar si el correo del usuario existe y el password es correcto regresando el id del usuario y un token de autenticacion
app.post('/login', express.json(), async (req, res) => {
  const { correo, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT id, nombre, password FROM usuarios WHERE correo = $1`,
      [correo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Correo no encontrado' });
    }

    const user = result.rows[0];
    
    if (user.password !== password) {
      return res.status(401).json({ error: 'Password incorrecto' });
    }

    // Generar token con expiración
    const token = jwt.sign(
      { 
        id: user.id,
        nombre: user.nombre,
        correo: correo
      },
      JWT_SECRET,
      { expiresIn: '2m' } // Token expira en 24 horas
    );

    res.json({
      id: user.id,
      nombre: user.nombre,
      token: token
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/tareas', async (req, res) => {
  try {
    // Recibir el usuario_id como parámetro de query
    const usuarioId = req.query.usuario_id;
    
    if (!usuarioId) {
      return res.status(400).json({ error: 'usuario_id es requerido' });
    }
    
    const result = await pool.query(
      'SELECT t.* FROM tareas t JOIN usuario_tarea ut ON t.id = ut.tarea_id WHERE ut.usuario_id = $1',
      [usuarioId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al consultar la base de datos:', err);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

/*app.get('/tareas', async (req, res) => {
  try {
    //const result = await pool.query('SELECT * FROM tareas ORDER BY id ASC')
    //const result = await pool.query('SELECT * FROM tareas ORDER BY finalizada')
    const result = await pool.query('SELECT t.* FROM tareas t JOIN usuario_tarea ut ON t.id = ut.tarea_id WHERE ut.usuario_id = 1')
    res.json(result.rows)
  } catch (err) {
    console.error('Error al consultar la base de datos:', err)
    res.status(500).json({ error: 'Error al consultar la base de datos' })
  }
})*/

app.post('/tareas', express.json(), async (req, res) => {
  const {
    nombre, descripcion, fecha_asignacion, hora_asignacion,
    fecha_entrega, hora_entrega, finalizada, prioridad,
    usuario_id  // ← Nuevo campo que recibimos del cliente
  } = req.body;
  
  try {
    // Validar que tenemos el usuario_id
    if (!usuario_id) {
      return res.status(400).json({ error: 'usuario_id es requerido' });
    }

    // 1. Primero insertar en la tabla tareas
    const tareaResult = await pool.query(
      `INSERT INTO tareas
        (nombre, descripcion, fecha_asignacion, hora_asignacion,
          fecha_entrega, hora_entrega, finalizada, prioridad)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nombre, descripcion, fecha_asignacion, hora_asignacion,
        fecha_entrega, hora_entrega, finalizada, prioridad]
    );

    const tarea = tareaResult.rows[0];

    // 2. Luego insertar en la tabla usuario_tarea la relación
    await pool.query(
      `INSERT INTO usuario_tarea (usuario_id, tarea_id)
       VALUES ($1, $2)`,
      [usuario_id, tarea.id]
    );

    res.status(201).json(tarea);
  } catch (err) {
    console.error('Error al insertar en la base de datos:', err);
    res.status(500).json({ error: 'Error al insertar en la base de datos' });
  }
});

/*app.post('/tareas', express.json(), async (req, res) => {
  const {
    nombre, descripcion, fecha_asignacion, hora_asignacion,
    fecha_entrega, hora_entrega, finalizada, prioridad
  } = req.body 
  try {
    const result = await pool.query(
      `INSERT INTO tareas
        (nombre, descripcion, fecha_asignacion, hora_asignacion,
          fecha_entrega, hora_entrega, finalizada, prioridad)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nombre, descripcion, fecha_asignacion, hora_asignacion,
        fecha_entrega, hora_entrega, finalizada, prioridad]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Error al insertar en la base de datos:', err)
    res.status(500).json({ error: 'Error al insertar en la base de datos' })
  }
})*/

app.delete('/tareas/:id', async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM tareas WHERE id = $1', [id])
    res.status(204).send()
  } catch (err) {
    console.error('Error al eliminar de la base de datos:', err)
    res.status(500).json({ error: 'Error al eliminar de la base de datos' })
  }
})

app.put('/tareas/:id', express.json(), async (req, res) => {
  const { id } = req.params
  const {
    nombre, descripcion, fecha_asignacion, hora_asignacion,
    fecha_entrega, hora_entrega, finalizada, prioridad
  } = req.body
  try {
    const result = await pool.query(
      `UPDATE tareas SET
        nombre = $1, descripcion = $2,
        fecha_asignacion = $3, hora_asignacion = $4,
        fecha_entrega = $5, hora_entrega = $6,
        finalizada = $7, prioridad = $8
      WHERE id = $9 RETURNING *`,
      [nombre, descripcion, fecha_asignacion, hora_asignacion,
        fecha_entrega, hora_entrega, finalizada, prioridad, id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('Error al actualizar la base de datos:', err)
    res.status(500).json({ error: 'Error al actualizar la base de datos' })
  }
})

export default app
