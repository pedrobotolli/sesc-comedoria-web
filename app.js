const result = require('dotenv').config()

if (result.error) {
  throw result.error
}
const express = require('express')
const app = express()
const agendamentos = require('./routes/agendamentos')
const porta = process.env.PORT || 3000

app.use('/agendamentos', agendamentos)

app.get('/horario', (req, res) => {

    let agora = new Date()
    res.status(200).json({ ano: agora.getFullYear(), mes: agora.getMonth(), dia: agora.getDate(), hora: agora.getHours(), minuto: agora.getMinutes() })

})


app.listen(porta, () => console.log('Servidor executando na porta: ' + porta))


