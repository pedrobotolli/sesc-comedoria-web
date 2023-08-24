const express = require('express')
const sesc = require('../connectors/sesc')
const router = express.Router()



router.get('/', (req, res, next) => {
    try {
        res.status(200).json({ agendamentos: [sesc.execucoesAgendadas] })
    }
    catch (error) {
        next(error)
    }
})

router.post('/novo', async (req, res, next) => {
    try {
        let credenciais = req.body.cpf && req.body.senha ? { usuarios: [{ cpf: req.body.cpf, senha: req.body.senha }] } : null
        let horarioEscolhido = req.body.horario || null
        let instanceId = Math.floor(Math.random() * 1000000000000000)
        sesc.execucoesAgendadas.push({ id: instanceId, status: 'pendente' })
        res.status(201).json({ msg: 'Nova instancia de agendamento criada', id: instanceId })

        await sesc.processoAgendamentoSesc(instanceId, credenciais, horarioEscolhido)
    } catch (error) {
        next(error)
    }

})

router.post('/novos', async (req, res, next) => {
    try {
        if (!req.body.usuarios)
            return res.status(400).json({ "msg": "Não foi possível encontrar a propriedade obrigatoria 'usuarios' no JSON enviado" })
        let credenciais = req.body
        let horarioEscolhido = req.body.horario || null
        let instanceId = Math.floor(Math.random() * 1000000000000000)
        sesc.execucoesAgendadas.push({ id: instanceId, status: 'pendente' })
        res.status(201).json({ msg: 'Nova instancia de agendamento criada', id: instanceId })

        await sesc.processoAgendamentoSesc(instanceId, credenciais, horarioEscolhido)

    } catch (error) {
        next(error)
    }
})

router.get('/status/:id', (req, res, next) => {

    try {
        let execucao = sesc.execucoesAgendadas.find(agendamento => agendamento.id == req.params.id)
        res.status(200).json(execucao)
    } catch (error) {
        next(error)
    }

})



module.exports = router