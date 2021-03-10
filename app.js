var WebSocketClient = require('websocket').client;
var protobuf = require("protobufjs");
var yahooStream = new WebSocketClient();
var yahooFinance = require('yahoo-finance');

const app = require('express')();
const express = require('express')
const http = require('http').Server(app)
const io = require('socket.io')(http);

app.use("/media/", express.static(__dirname + '/routes/media'));
app.use("/scripts/", express.static(__dirname + '/routes/scripts'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/routes/index.html');
});



var registeredSockets = new Array();



function emitArrayio(message){

    if (message.id === 'AUDUSD=X'){
        var dollarLatest = message.price
        var socketprice = message.price
    } else if (message.id === 'ANZBY' || message.id === 'CMWAY' || message.id === 'WBK') {
        var socketprice = message.price * dollarLatest
    } else if (message.id === 'NABZY') {
        var socketprice = message.price * dollarLatest * 2
    } else if (message.id === 'ES=F' || message.id === 'YM-F') {
        var socketprice = message.price * dollarLatest
    }  else {
        var socketprice = message.price
    }

    registeredSockets.forEach((regId => {
        io.to(regId).emit(message.id, socketprice)
    }))
}

function addSocket(id) {
    registeredSockets.push(id)
}

function removeSocket(id) {
    registeredSockets = registeredSockets.filter(item => item !== id)
}


io.on('connection', (socket) => {
     // console.log('a user connected');

    addSocket(socket.id)

    socket.on('disconnect', () => {
        removeSocket(socket.id)
    });

});


http.listen(3000, () => {
    console.log('listening on *:3000');
});


async function protoDecode(socketMessage) {
    const root = await protobuf.load("yahoo/PricingData.proto")
    const pricingData = root.lookupType("yaticker")

    const err = pricingData.verify(socketMessage);
    if (err) {
        console.log('err')
        throw err;
    }
    const message = pricingData.decode(socketMessage);
    return message;
}


yahooStream.on('connectFailed', function (error) {
    console.log('Connect Error: ' + error.toString());
});

yahooStream.on('connect', function (connection) {
    console.log('Yahoo Stream Connected');
    connection.on('error', function (error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function () {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', async function (message) {
        if (message.type === 'utf8') {
            // console.log("Received: '" + message.utf8Data + "'");

            var decodedResponse = await protoDecode(Buffer.from(message.utf8Data, 'base64'))
          
            emitArrayio(decodedResponse)
        }
    });

    function sendMessage() {
        if (connection.connected) {
            var number = Math.round(Math.random() * 0xFFFFFF);
            connection.sendUTF('{"subscribe":["ANZ.AX","CBA.AX", "NAB.AX", "WBC.AX", "AUDUSD=X", "YM=F", "ES=F", "CMWAY", "WBK", "NABZY", "ANZBY"]}');
        }
    }
    sendMessage();
});

yahooStream.connect('wss://streamer.finance.yahoo.com/');




app.get('/prices', async function (req, res) {

    async function getAusADR() {

        var AUDUSDquote = await yahooFinance.quote({
            symbol: "AUDUSD=X",
            module: 'price', // see the docs for the full list
        }, function (err, quotes) {

        });

        var AUDUSDprice = AUDUSDquote["price"]["regularMarketPrice"]


        var AusADR = await yahooFinance.quote({
            symbols: ['CMWAY', 'WBK', 'ANZBY', 'NABZY'],
            module: 'price', // see the docs for the full list
        }, function (err, quotes) {


        });


        var ticketPrices = {
            'time': AusADR[Object.keys(AusADR)[0]].price.regularMarketTime.toLocaleString(),
            'CMWAY': (AusADR["CMWAY"].price.regularMarketPrice / AUDUSDprice).toFixed(2),
            'WBK': (AusADR["WBK"].price.regularMarketPrice / AUDUSDprice).toFixed(2),
            'ANZBY': (AusADR["ANZBY"].price.regularMarketPrice / AUDUSDprice).toFixed(2),
            'NABZY': (AusADR["NABZY"].price.regularMarketPrice * 2 / AUDUSDprice).toFixed(2),
        }


        return ticketPrices
    }

    async function getAusTickets() {

        var AusTickets = await yahooFinance.quote({
            symbols: ['CBA.AX', 'WBC.AX', 'ANZ.AX', 'NAB.AX'],
            module: 'price', // see the docs for the full list
        }, function (err, quotes) {

        })


        var ticketPrices = {
            'time': AusTickets[Object.keys(AusTickets)[0]].price.regularMarketTime.toLocaleString(),
            'CBA': AusTickets["CBA.AX"].price.regularMarketPrice.toFixed(2),
            'WBC': AusTickets["WBC.AX"].price.regularMarketPrice.toFixed(2),
            'ANZ': AusTickets["ANZ.AX"].price.regularMarketPrice.toFixed(2),
            'NAB': AusTickets["NAB.AX"].price.regularMarketPrice.toFixed(2)
        }

        return ticketPrices

    }



    var AusADR = await getAusADR()

    var AusTickets = await getAusTickets()

    var response = {
        ausADR: AusADR,
        ausTickets: AusTickets
    }

    return res.send(JSON.stringify(response))


})



app.get('/futurePrices', async function (req, res) {

    var futurePrices = await yahooFinance.quote({
        symbols: ['YM=F', 'ES=F'],
        module: 'price', // see the docs for the full list
    }, function (err, quotes) {

    })

    return res.send(JSON.stringify(futurePrices))
})
