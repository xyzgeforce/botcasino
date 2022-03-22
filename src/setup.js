const readline = require('readline');
const utils = require('./utils.js')

const DEFAULT_MAX_BETS = 5
const DEFAULT_VERIFICATIONS = 1500
const DEFAULT_MIN_BALANCE = 5

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const ask = (question) => new Promise(resolve => {
    reader.question(question, answer => resolve(answer))
})

async function askMaxBets() {
    let answer = await ask("Máximo de apostas? (5) \n")

    if (answer === "") {
        return DEFAULT_MAX_BETS
    }

    return Number(answer)
}

async function askVerifications() {
    let answer = await ask("Quantas verificações? (1500)\n")

    if (answer === "") {
        return DEFAULT_VERIFICATIONS
    }

    return Number(answer)
}

async function askUsername() {
    let answer = await ask("Usuário: \n")

    if (answer === "") {
        throw Error("O Usuário não pode ser vazio")
    }

    return answer
}

async function askPassword() {
    let answer = await ask("Senha: \n")

    if (answer === "") {
        throw Error("A senha não pode ser vazia")
    }

    return answer
}

const runSetup = async function () {
    return new Promise(async (resolve, reject) => {
        try {
            
            await utils.clearFolder('screenshots')

            let maxBets = await askMaxBets()
            let verifications = await askVerifications()
            let username = await askUsername()
            let password = await askPassword()
            let minBalance = DEFAULT_MIN_BALANCE

            resolve({ maxBets, verifications, username, password, minBalance })
        } catch (e) {
            reject(e)
        } finally {
            reader.close()
        }
    })
}

module.exports = {
    runSetup
}
