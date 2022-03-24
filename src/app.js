const fs = require('fs')

const setup = require('./setup.js')
const utils = require('./utils.js')
const actions = require('./actions.js')
const betManager = require('./bet_manager.js')
const vars = require('./vars.js')
const puppeteer = require('puppeteer');

const INITAL_CASINO = "bet365 Roulette"
const VERIFICATION_DELAY = 1500

var lastEnterTable = INITAL_CASINO
var isExpand = false
var betRealizedCount = 0
var betLossCount = 0
var betGreenCount = 0

async function createBrowser() {
    return await puppeteer.launch()
}

async function saveCookies(page) {
    try {
        const cookies = await page.cookies();
        fs.writeFileSync(vars.exportFiles.cookies, JSON.stringify(cookies, null, 2));
        console.log('Cookies salvos -> ', cookies.length)
    } catch (e) {
        console.log('Não foi possível salvar os cookies')
        console.error(e.message)
    }
}

function readCookies() {
    try {
        let cookies = fs.readFileSync('cookies.json', 'utf-8')
        if (cookies){
            return JSON.parse(cookies)
        } else {
            return ""
        }
    } catch (e) {
        console.log('Não foi possível ler os cookies')
        console.error(e.message)
        return []
    }
}

async function createPage(browser) {
    const page = await browser.newPage();
    await page.setViewport(vars.viewPort);
    await page.setExtraHTTPHeaders(vars.headers);
    await page.setUserAgent(vars.userAgent);
    return page
}

async function initHomePage(page) {
    console.log('\nInitializing...\n')
    await page.goto(vars.HOME_URL);
    await page.waitForXPath('//*[contains(text(), "Login")]', { timeout: 0 })
    await utils.sleep(5000)
    await actions.printScreen(page)
}

async function login(page, username, password) {
    console.log('Starting login...')

    await page.mouse.click(1648, 66.5)
    await utils.sleep(1000)

    await page.type('.lms-StandardLogin_Username ', username)
    await utils.sleep(1000)

    await page.type('.lms-StandardLogin_Password ', password)
    await utils.sleep(1000)

    await page.click('.lms-LoginButton ')
    await utils.sleep(15000)
    await saveCookies(page)

    console.log('Login success!\n')
    await actions.printScreen(page)
}

async function openCasinoLive(page) {
    console.log('Opening casino live...')
    await page.goto('https://casino.bet365.com/Play/LiveRoulette')
    await page.waitForXPath('//*[contains(text(), "Live Roulette ")]', { timeout: 0 })
    await utils.sleep(35000)
    await actions.printScreen(page)
    console.log('Casino opened!\n')
}

async function findCasinoFrame(page) {
    let casinoFrame = await actions.findCasinoFrame(page)
    await actions.printScreen(page)
    return casinoFrame
}

async function closeCasinoLive(page, casinoFrame) {
    await actions.closeCasinoLive(casinoFrame)
    await utils.sleep(5000)
    await actions.printScreen(page)
}

async function closeCasinoOffers(page, casinoFrame) {
    await betManager.clickAnnouncementButton(page, casinoFrame)
    await utils.sleep(2000)
}

async function clickRouletteTab(page, casinoFrame) {
    await actions.clickRouletteTab(casinoFrame)
    await utils.sleep(2000)
    await actions.printScreen(page)
}

async function logout(page) {
    console.log('\nEncerrando...\n')
    if (isExpand) await toggleExpand(page)

    await betManager.clickHeaderAccount(page)
    await utils.sleep(2000)

    await betManager.clickMenuExit(page)
    await utils.sleep(2000)

    await actions.printScreen(page)
}

async function toggleExpand(page) {
    console.log(isExpand ? 'Collapsing...' : 'Expanding...')
    isExpand = !isExpand
    await actions.toggleExpandTables(page)
    await utils.sleep(2000)
    await actions.printScreen(page)
}

async function mouseUpAndDown(page) {
    await page.keyboard.press('ArrowDown')
    await utils.sleep(300)
    await page.keyboard.press('ArrowUp')
}

function hasBalanceToBet(balance, minBalance) {
    let hasBalance = balance > minBalance
    if (!hasBalance) console.log('Saldo insuficiente para continuar =/\n')
    return hasBalance
}

async function printBetsResult(casinoFrame) {
    console.log(`Apostas realizadas: ${betRealizedCount}\n`)
    console.log(`GREEN: ${betGreenCount}\n`)
    console.log(`LOSS: ${betLossCount}\n`)

    const balance = await actions.getBalance(casinoFrame)
    printBalance(balance)
}

function printBalance(balance) {
    console.log(`Saldo R$ ${balance}\n`.replace('.', ','))
}

function shouldContinueVerification(verifications, config) {
    
    if (betLossCount === config.maxLoss) {
        console.log('Máximo de loss configurado foi atingido!\n')
        return false
    }

    if (verifications >= config.verifications) {
        console.log('Limite de verificações atingido!\n')
        return false
    }

    if (betRealizedCount > config.maxBets) {
        console.log('Limite de apostas atingido!\n')
        return false
    }

    return true
}

function printError(e) {
    console.error(`Error -> ${e.message}\n`)
    console.log('-------------------------')
    console.log(`\n${e.stack}\n`)
    console.log('-------------------------')
}

async function executeVerificationsToBet(page, casinoFrame, config) {
    var verifications = 1

    while (shouldContinueVerification(verifications, config)) {

        verifications += 1
        await utils.sleep(VERIFICATION_DELAY)
        await mouseUpAndDown(page)

        let tables = await actions.findTablesToBet(casinoFrame)
        let possibleBets = betManager.findPossibleBet(tables, config)
        let hasPossibleBet = possibleBets.length > 0

        console.log(`Verificação ${verifications}, Mesas ${tables.length}, Possíveis apostas ${possibleBets.length}`)

        // needed to avoid auto disconnect
        if (verifications % 300 === 0) {
            console.log('\nOpen some table to avoid disconnect!')
            await actions.printScreen(page)

            let random = Math.floor(Math.random() * tables.length)
            let someTable = tables[random]
            await actions.openTable(casinoFrame, someTable)
            await utils.sleep(8000)
            await actions.closeCasinoLive(casinoFrame)
            continue 
        }

        if (!hasPossibleBet) {
            continue
        }

        let randomBet = Math.floor(Math.random() * possibleBets.length)
        let possibleBet = possibleBets[randomBet]

        if (lastEnterTable === possibleBet.name) {
            continue
        }

        lastEnterTable = possibleBet.name

        let balance = await actions.getBalance(casinoFrame)
        printBalance(balance)

        if (!hasBalanceToBet(balance, config.minBalance)) {
            continue
        }

        let result = await betManager.bet(page, casinoFrame, possibleBet, config)

        if (result.isBetRealized) {
            betRealizedCount += 1
            console.log(`Apostas realizadas: ${betRealizedCount}\n`)
        
            if (result.isResultGreen) {
                betGreenCount += 1
            } else {
                betLossCount += 1
            }
        }
    }
}

async function start() {

    const config = await setup.runSetup()
    const browser = await createBrowser()
    const page = await createPage(browser)

    try {

        await initHomePage(page)
        await login(page, config.username, config.password)
        await openCasinoLive(page)

        let casinoFrame = await findCasinoFrame(page)

        await closeCasinoOffers(page, casinoFrame)
        await closeCasinoLive(page, casinoFrame)
        await clickRouletteTab(page, casinoFrame)
        await toggleExpand(page)

        let balance = await actions.getBalance(casinoFrame)
        printBalance(balance)

        if (hasBalanceToBet(balance, config.minBalance)) {
            await executeVerificationsToBet(page, casinoFrame, config)
        }

        await printBetsResult(casinoFrame)
        await logout(page)
    } catch (e) {
        printError(e)
        await actions.printScreen(page)
    } finally {
        await browser.close()
    }
}

start();