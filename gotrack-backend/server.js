const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let carreras = [];

app.get('/api/carreras', (req, res) => {
  res.json(carreras);
});

app.post('/api/carreras', (req, res) => {
  const nuevaCarrera = req.body;
  carreras.push(nuevaCarrera);
  console.log('Carrera recibida:', nuevaCarrera);
  res.status(201).json({ message: 'Carrera guardada con éxito', carrera: nuevaCarrera });
});

app.listen(PORT, () => {
  console.log(`Servidor GOTRACK escuchando en http://localhost:${PORT}`);
});