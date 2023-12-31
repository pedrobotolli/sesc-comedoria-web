
# API de agendamentos na comedoria SESC-SP

API criada para realizar o agendamento automático nas comedorias das unidades do SESC de São Paulo.


## Instalação

Para utilizar o projeto, é necessário utilizar a versão v12.22.12 do Node. 

Instalando os pacotes necessários:

```bash
  npm install
```

Rodando a aplicação:

```bash
  node app.js
```
    
## Documentação da API




#### Retorna todos os agendamentos realizados

```http
  GET /agendamentos
```

#### Retorna um agendamento pelo id

```http
  GET /agendamentos/status/${id}
```

| Parâmetro   | Tipo       | Descrição                                   |
| :---------- | :--------- | :------------------------------------------ |
| `id`      | `integer` | **Obrigatório**. O ID do item que você quer |

#### Cria um novo agendamento

```http
  POST /agendamentos/novo
```

| Propriedade   | Tipo       | Descrição                                   |
| :---------- | :--------- | :------------------------------------------ |
| `cpf`      | `string` | **Obrigatório**. O CPF do usuário. |
| `senha`    | `string` | **Obrigatório**. Senha do usuário. |
| `horario`  | `string` | Horário de interesse para agendamento. Exemplo: 13:30|

```
  {
    "cpf": "12345678910",
    "senha": "sua senha",
    "horario": "12:00"  
  }
```

#### Cria vários agendamentos

```http
  POST /agendamentos/novos
```
| Propriedade   | Tipo       | Descrição                                   |
| :---------- | :--------- | :------------------------------------------ |
| `horario`  | `string` | Horário de interesse para agendamento. Exemplo: 13:30|
| `usuarios`      | `array` | **Obrigatório**. Uma lista de agendamentos. |
| `cpf`      | `string` | **Obrigatório**. O CPF do usuário. |
| `senha`    | `string` | **Obrigatório**. Senha do usuário. |


```
  {
    "horario": "13:00"
    "usuarios": [
      {
        "cpf": "12345678910",
        "senha": "senha1"          
      },
      {
        "cpf": "10987654321",
        "senha": "senha2"  
      }
    ]
  }
```