import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pkg from 'pg'

dotenv.config()
const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necesario para Neon
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Middleware para JSON (para futuros POST)
app.use(express.json())

// Home route - HTML (NO SE QUITA)
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
          <a href="/api-data">API Data</a>
          <a href="/tareas">Tareas (DB)</a>
          <a href="/healthz">Health</a>
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

// Example API endpoint - JSON
app.get('/api-data', (req, res) => {
  res.json({
    message: 'Here is some sample API data',
    items: ['apple', 'banana', 'cherry'],
  })
})

// 🚀 Nueva ruta: consulta base de datos Neon
app.get('/tareas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tareas')
    res.json(result.rows)
  } catch (err) {
    console.error('Error al consultar la base de datos:', err)
    res.status(500).json({ error: 'Error al consultar la base de datos' })
  }
})
/*
body -> 
{
  "nombre": "Tarea de ejemplo",
  "descripcion": "Esta es una tarea de ejemplo.",
  "fecha_asignacion": "2024-06-01",
  "hora_asignacion": "10:00:00",
  "fecha_entrega": "2024-06-05",
  "hora_entrega": "18:00:00",
  "finalizada": false,
  "prioridad": 5
}
*/
app.post('/tareas', express.json(), async (req, res) => {
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
})

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// POST ejemplo
app.post('/submit', express.json(), (req, res) => {
  const data = req.body
  res.json({ received: data, status: 'success' })
})

export default app
