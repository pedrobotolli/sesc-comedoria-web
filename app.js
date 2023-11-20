const result = require('dotenv').config({silent: true})

const logger = require('./connectors/logger')
const express = require('express')
const cors = require('cors')
const cron = require('node-cron')
const app = express()
const agendamentos = require('./routes/agendamentos')
const sesc = require('./connectors/sesc')
const porta = process.env.PORT || 3000

app.use(express.json())

app.use('/agendamentos', agendamentos)

// Para verificar o horario do servidor
app.get('/horario', (req, res) => {

    let agora = new Date()
    res.status(200).json({ ano: agora.getFullYear(), mes: agora.getMonth(), dia: agora.getDate(), hora: agora.getHours(), minuto: agora.getMinutes() })

})

// Permitindo CORS para que algum front possa usar essa api estando em outro dominio
app.use(cors())


// tratamento de erros
app.use((error, req, res, next) => {
  return res.status(500).send({ error })
})



app.listen(porta, () => {
  logger.info('Servidor executando na porta: ' + porta)
  sesc.processoAgendamentoSesc()

  cron.schedule('28 14 * * *', () => {
    sesc.processoAgendamentoSesc1430()
  })
  
  cron.schedule('*/3 * * * *', () => {
     sesc.processoAgendamentoSesc()
   })
})


