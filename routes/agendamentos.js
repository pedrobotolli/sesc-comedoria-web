const express = require('express')
const sesc = require('../connectors/sesc')
const router = express.Router()



router.get('/', (req, res) => {

    res.status(200).json({ agendamentos: [sesc.execucoesAgendadas] })

})

router.get('/novo', async (req, res) => {
    let credenciais = req.query.cpf && req.query.senha ? {usuarios: [{cpf: req.query.cpf, senha: req.query.senha}]} : null
    let horarioEscolhido = req.query.horario || null
    let instanceId = Math.floor(Math.random() * 1000000000000000)
    sesc.execucoesAgendadas.push({ id: instanceId, status: 'pendente' })
    res.status(201).json({ msg: 'Nova instancia de agendamento criada', id: instanceId })

    await sesc.processoAgendamentoSesc(instanceId, credenciais, horarioEscolhido)

})

router.get('/status/:id', (req, res) => {

    let execucao = sesc.execucoesAgendadas.find(agendamento => agendamento.id == req.params.id)
    res.status(200).json(execucao)

})



module.exports = router