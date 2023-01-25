const qs = require('qs');
const BigNumber = require('bignumber.js');

let currentTrade = {};
let currentSelectSide;
let tokens;

async function init() {
    await listAvailableTokens();
}

// Uniswap имеет проект https://tokenlists.org/, стандарт для создания списков токенов ERC20 для фильтрации высококачественных, 
// законных токенов от мошенничества, подделок и дубликатов.
async function listAvailableTokens(){
    console.log("initializing");
    // Список CoinGecko — один из самых надежных, поэтому мы будем использовать этот запрос.
    let response = await fetch('https://tokens.coingecko.com/uniswap/all.json');
    let tokenListJSON = await response.json();
    console.log("listing available tokens: ", tokenListJSON);
    tokens = tokenListJSON.tokens;
    console.log("tokens: ", tokens);

    // Создаем список токенов для модального окна.
    let parent = document.getElementById("token_list");
    for (const i in tokens){
        // Строка с информацией о токене в окне.
        let div = document.createElement("div");
        div.className = "token_row";
        // Отобразить изображение и символ выбранного токена в поле обмена.
        let html = `
        <img class="token_list_img" src="${tokens[i].logoURI}">
          <span class="token_list_text">${tokens[i].symbol}</span>
          `;
        div.innerHTML = html;
        // selectToken() вызывается при клике на токен.
        div.onclick = () => {
            selectToken(tokens[i]);
        };
        parent.appendChild(div);
    };
}

async function selectToken(token){
    // Автоматически закрывает окно при выборе токена.
    closeModal();
    // Отслеживает, на какой стороне торговли мы находимся — до или после.
    currentTrade[currentSelectSide] = token;
    // Выводит выбранный токен в лог для отладки.
    console.log("currentTrade: ", currentTrade);
    renderInterface();
}

// Функция, отражающая символ и имя токена.
function renderInterface(){
    if (currentTrade.from){
        console.log(currentTrade.from);
        // Устанавливает символ токена.
        document.getElementById("from_token_img").src = currentTrade.from.logoURI;
        document.getElementById("from_token_text").textContent = "";
        // Устанавливает название токена.
        document.getElementById("from_token_text").innerHTML = currentTrade.from.symbol;
    }
    if (currentTrade.to){
        console.log(currentTrade.to)
        // Устанавливает символ токена.
        document.getElementById("to_token_img").src = currentTrade.to.logoURI;
        document.getElementById("to_token_text").textContent = "";
        // Устанавливает название токена.
        document.getElementById("to_token_text").innerHTML = currentTrade.to.symbol;
    }
}

// Подключение к MetaMask.
// Мы хотим, чтобы пользователи могли выполнять обмен только в том случае, если у них установлен кошелек MetaMask.
async function connect() {
    // Metal Mask предоставляет API для веб-сайтв, посещаемых его пользователями в window.ethereum. 
    // Этот API позволяет веб-сайтам запрашивать учетные записи пользователей Ethereum, считывать данные из блокчейнов, 
    // к которым подключен пользователь, и предлагать пользователю подписывать сообщения и транзакции. 
    // Наличие объекта provider указывает на пользователя Ethereum. Источник: https://ethereum.stackexchange.com/a/68294/85979

    // Проверяем, установлен ли MetaMask, если это так, пробуем подключиться к учетной записи.
    if (typeof window.ethereum !== "undefined") {
        try {
            console.log("connecting");
            // Запрашивает, чтобы пользователь предоставил адрес Ethereum для идентификации. Запрос вызывает появление всплывающего окна MetaMask.
            await ethereum.request({ method: "eth_requestAccounts" });
        } catch (error) {
            console.log(error);
        }
        // При успешном подключении, кнопка меняется на "Подключено".
        document.getElementById("login_button").innerHTML = "Подключено";
        // const accounts = await ethereum.request({ method: "eth_accounts" });
        document.getElementById("swap_button").disabled = false;
    } else {
        // Если MetaMask не установлен, просим пользователя его установить.
        document.getElementById("login_button").innerHTML = "Пожалуйста, установите MetaMask";
    }
}

//  Функция, которая открывает модальное окно при нажатии на надпись "Выберете токен".
function openModal(side){
    // Сохраняет, выбрал ли пользователь токен на стороне "До" или "После".
    currentSelectSide = side;
    document.getElementById("token_modal").style.display = "block";
}

//  Функция, которая закрывает модальное окно при нажатии на крестик.
function closeModal(){
    document.getElementById("token_modal").style.display = "none";
}

// Функция вызывает endpoint https://docs.0x.org/0x-api-swap/api-references/get-swap-v1-price
// 
async function getPrice(){
    console.log("Getting Price");
  
    // Добавляем оператор, потому что мы хотим запустить запрос только в том случае, е
    // если были выбраны токены from и to, а также введена сумма токена from.
    if (!currentTrade.from || !currentTrade.to || !document.getElementById("from_amount").value) return;
    // Сумма рассчитывается исходя из наименьшей базовой единицы токена. 
    // Мы получаем это путем умножения (от суммы) x (10 в степени количества знаков после запятой).
    let amount = Number(document.getElementById("from_amount").value * 10 ** currentTrade.from.decimals);
  
    // Устанавливаются параметры.
    const params = {
        sellToken: currentTrade.from.address,
        buyToken: currentTrade.to.address,
        sellAmount: amount,
    }
  
    // Загружается цена обмена.
    const response = await fetch(`https://api.0x.org/swap/v1/price?${qs.stringify(params)}`);
    
    // Ожидаем и парсим JSON-ответ.
    swapPriceJSON = await response.json();
    console.log("Price: ", swapPriceJSON);
    
    // Используются возвращенные значения для заполнения суммы покупки и расчетного расхода газа в пользовательском интерфейсе.
    document.getElementById("to_amount").value = swapPriceJSON.buyAmount / (10 ** currentTrade.to.decimals);
    document.getElementById("gas_estimate").innerHTML = swapPriceJSON.estimatedGas;
}

// Использовать адрес учетной записи пользователя в MetaMask для получения котировки.
// Функция возвращает ордер, в который маркет-мейкер вложил свои активы.
async function getQuote(account){
    console.log("Getting Quote");
  
    if (!currentTrade.from || !currentTrade.to || !document.getElementById("from_amount").value) return;
    let amount = Number(document.getElementById("from_amount").value * 10 ** currentTrade.from.decimals);
  
    const params = {
        sellToken: currentTrade.from.address,
        buyToken: currentTrade.to.address,
        // sellToken: "ETH",
        // buyToken: "WETH",
        sellAmount: amount,
        // takerAddress: account,
        affiliateAddress: account,
    }
    console.log("Params:");
    console.log(params);
    // Загружает цитату для обмена.
    const response = await fetch(`https://api.0x.org/swap/v1/quote?${qs.stringify(params)}`);
    
    swapQuoteJSON = await response.json();
    console.log("Quote: ", swapQuoteJSON);
    
    document.getElementById("to_amount").value = swapQuoteJSON.buyAmount / (10 ** currentTrade.to.decimals);
    document.getElementById("gas_estimate").innerHTML = swapQuoteJSON.estimatedGas;
  
    return swapQuoteJSON;
}

// Функция, реализующая обмен токенов.
async  function  trySwap(){
    console.log("Swapping...");

    // Адрес, если таковой имеется, последней используемой учетной записи, к которой абоненту разрешен доступ.
    let accounts = await ethereum.request({ method: "eth_accounts" });
    let takerAddress = accounts[0];
    // Регистрируем самый последний использованный адрес в нашем MetaMask кошельке.
    console.log("takerAddress: ", takerAddress);
    // Передаем этот как параметр учетной записи в getQuote(), который мы создали ранее. Это вернет торговый ордер объекта JSON. 
    const  swapQuoteJSON = await  getQuote(takerAddress);

    // Настроим erc20abi в формате json, чтобы мы могли взаимодействовать с приведенным ниже методом утверждения.
    const erc20abi= [{ "inputs": [ { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "symbol", "type": "string" }, { "internalType": "uint256", "name": "max_supply", "type": "uint256" } ], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Transfer", "type": "event" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" } ], "name": "allowance", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "account", "type": "address" } ], "name": "balanceOf", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "burn", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "account", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "burnFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [ { "internalType": "uint8", "name": "", "type": "uint8" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "subtractedValue", "type": "uint256" } ], "name": "decreaseAllowance", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "addedValue", "type": "uint256" } ], "name": "increaseAllowance", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "name", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transfer", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "sender", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transferFrom", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }]
    // Настроим сумму одобрения для токена, с которого мы хотим торговать.
    const fromTokenAddress = currentTrade.from.address;

    // Для того, чтобы мы могли взаимодействовать с методом контракта arc 20, необходимо создать объект web3. 
    // Этому объекту web3.eth.Contract требуется erc20abi, который мы можем получить из любого erc20 abi, 
    // а также конкретный адрес токена, с которым мы заинтересованы во взаимодействии, в данном случае это fromTokenAddrss.
    const  web3 = new  Web3(Web3.givenProvider);
    const ERC20TokenContract = new web3.eth.Contract(erc20abi, fromTokenAddress);
    console.log("setup ERC20TokenContract: ", ERC20TokenContract);
    // Здесь задано максимальное разрешение. Использование большого числа для обработки больших чисел и учета переполнения.
    const maxApproval = new BigNumber(2).pow(256).minus(1);
    console.log("approval amount: ", maxApproval);
    // Предоставим целевому получателю пособия (прокси-серверу обмена 0x) разрешение на расходование наших токенов. 
    // Это txn, за который взимается плата.
    const tx = await ERC20TokenContract.methods.approve(
        swapQuoteJSON.allowanceTarget,
        maxApproval,
    )
    .send({ from: takerAddress })
    .then(tx => {
        console.log("tx: ", tx);
    });

    // Производится обмен.
    const  receipt = await  web3.eth.sendTransaction(swapQuoteJSON);
    console.log("receipt: ", receipt);
}

init();

// Привязка функций к вызывающим их кнопкам.
document.getElementById("login_button").onclick = connect;
document.getElementById("from_token_select").onclick = () => {
    openModal("from");
};
document.getElementById("to_token_select").onclick = () => {
    openModal("to");
};
document.getElementById("modal_close").onclick = closeModal;
// Вызываем обновление цены, когдаа пользователь убирает мышку с поля ввода.
document.getElementById("from_amount").onblur = getPrice;
document.getElementById("swap_button").onclick = trySwap;