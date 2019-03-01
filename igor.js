/* Telegram Bot "Igor"


Using the Telegram module from http://telegraf.js.org/


TODO
- change db handling to https://stackoverflow.com/a/40745825/131146
  -> better error handling, currently error handlers pile onto each other
- use Winston for logging

*/

const Telegraf = require('telegraf')
const { session, reply } = require('telegraf')
const mysql = require('promise-mysql')
const util = require('util')
const moment = require('moment')
const fs = require('fs');
const path = require('path');
const app = require('express')()
const basicAuth = require('express-basic-auth')
const http = require('http').Server(app)
const dns = require('dns')
const winston = require('winston')

const auth = require('./auth.js')()
const undo = require('./undo.js')

process.on('SIGINT', function () {
    console.log("Bye, Bye...")
    process.exit(0)
})

process.on('uncaughtException', (err) => {
    console.error("Igor committing suicide: there was an unhandled exception: " + err)
    console.log(err.stack)
    process.exit(1)
})

process.on('unhandledRejection', (err) => {
    console.error("Igor committing suicide: there was an unhandled promise rejection: " + err)
    console.error(err.stack);
    process.exit(2)
})

// start bot with: export NODE_ENV=prod && npm start
const NODE_ENV = process.env.NODE_ENV
switch (NODE_ENV) {
    case 'prod':
        sConfigFile = 'prod.json'
		break;
	default:
        sConfigFile = 'dev.json'
		break;
}
console.log("\n\n\n\n\n\n\n\n\n\n")
console.log("Loading config " + sConfigFile)
let configBuffer = fs.readFileSync(path.resolve(__dirname, 'config', sConfigFile), 'utf-8')
let config = JSON.parse(configBuffer)


const bot = new Telegraf(config.tg_botkey)
bot.use(session())

var god = {
    config: config,
    executeSql: function() { console.error("god.executeSql should have been overridden") },
    bot: bot,
    auth: auth,
}

god.sqlPool = mysql.createPool({
    connectionLimit : 100,
    host     : config.db_host,
    user     : config.db_user,
    password : config.db_pwd,
    database : config.db_db,
});

god.executeSql = async function(sqlString, values) {
	try {
		const connection = await god.sqlPool.getConnection();
		try {
			const rows = await connection.query(sqlString, values);
			return rows;
		} finally {
			god.sqlPool.releaseConnection(connection);
		}
	} catch (err) {
		console.log("Error in SQL connection: " + err)
		throw err
	}
}



/* Returns a function which throws an exception with the given msg as format string and parameters given to the function. For use in catch handlers. */
function rethrow(msg) {
	return (cause) => { throw util.format(msg, cause) }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// Winston test
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
function addNamedLogger(name, level = 'debug', label = name) {
    let { format } = require('logform');
	let getFormat = (label, colorize = false) => {
		let nop = format((info, opts) => { return info })
		return format.combine(
			colorize ? format.colorize() : nop(),
			format.timestamp({
				format: 'YYYY-MM-DD HH:mm:ss',
			}),
			format.label({ label: label }),
			format.splat(),
			format.printf(info => `${info.timestamp} [${info.level}] [${info.label}] \t${info.message}`)
			)
	}
	winston.loggers.add(name, {
	  level: level,
	  transports: [
		new winston.transports.Console({
			format: getFormat(label, true),
		}),
		new winston.transports.File({ 
			format: getFormat(label, false),
			filename: 'ledstrip.log'
		})
	  ]
	})
}
addNamedLogger('main', 'debug')
const logger = winston.loggers.get('main')

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// Webserver test
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
app.use('/', require('express').static(__dirname + '/public'))

app.use(basicAuth({
    users: { 'igor': config.api_passwd },
	challenge: true,
	realm: 'Tg Igor',
}))

app.get('/cmd/:sId', async function(req, res) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	var sId = req.params.sId
	try {
		var rdns = await util.promisify(dns.reverse)(ip)
	} catch(error) {
		console.log("DNS error: " + error)
		rdns = ip
	}
	logger.info("Command %s requested by %s (%s)", sId, ip, rdns)
	if (sId == "home") {
		res.send("Welcome home")
		let msg = "Welcome home"
		await bot.telegram.sendMessage(config.owner.chatId, msg)
	} else {
     	logger.error("Command not found: " + sId)
		res.status(404).send('Command not found: ' + sId)
	}
})



// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Returns the oUser object with all known infos about a tg user. If no user is found, and createNew=true, a new DB entry is inserted. Otherwise returns null. */
async function getUserDetails(tg_id, createNew) {
    let rows = await god.executeSql("SELECT * FROM users WHERE tg_id = " + tg_id).catch(rethrow("GetUser: SQL failed: %s"))
	if (rows.length == 1) {
		user = rows[0]
//		console.log("GetUser: user '" + user.username + "' found")
		return user
	}
	if (createNew) {
		// TODO
		console.log("TODO GetUser: no user found, creating a new one")
		throw "user id " + tg_id + " unknown, should have created it now..."
	}
    console.log("GetUser: no user found for id " + tg_id + ", rejecting")
	return null
}

/* Forwards the message inside ctx to the bot owner, along with a custom 'msg' string */
async function notifyZefiro(ctx, msg) {
    await bot.telegram.sendMessage(config.owner.chatId, msg)
    await bot.telegram.forwardMessage(config.owner.chatId, ctx.chat.id, ctx.message.message_id)
}

// This is called for every interaction, and ensures the proper user object is loaded, as well as handling exceptions
bot.use(async (ctx, next) => {
    const start = moment()
	if (ctx.from.is_bot) {
		console.log("A bot tried to interact with me -> ignored")
		await notifyZefiro(ctx, "A bot tried to interact with me: @" + ctx.from.username + " (" + ctx.from.id + ")")
		return
	}

	let timerMsg = ''
	if (ctx.updateType == 'message') {
		console.log("<" + ctx.from.username + "> " + ctx.message.text)
		timerMsg = "<" + ctx.from.username + "> " + ctx.message.text
	} else if (ctx.updateType == 'callback_query') {
		console.log("[" + ctx.from.username + "] option " + ctx.update.callback_query.data)
		timerMsg = "[" + ctx.from.username + "] option " + ctx.update.callback_query.data
	} else if (ctx.updateType == 'edited_message') {
		console.log("Message updated to: " + ctx.update.edited_message.text)
	} else {
		console.log("Unknown type of update: " + ctx.updateType)
		return; // stop further processing
	}

	ctx.state.oUser = await getUserDetails(ctx.from.id)
	if (!ctx.state.oUser) {
		console.log("Auth: getUser failed for @" + ctx.from.username + " (" + ctx.from.id + ")")
        await ctx.reply("I'm sorry, my friend, this bot is not for you.")
		await notifyZefiro(ctx, "Someone chatted me up: @" + ctx.from.username + " (" + ctx.from.id + ")")
		return
	}
	try {
		await next()
	} catch(cause) {		
		let errId = new Date().valueOf().toString(16)
		console.log("Unhandled exception " + errId + ":\n" + cause)
		await ctx.reply("Terribly sorry, but an internal error occured :(\n(Error ID: " + errId + ")")
		await notifyZefiro(ctx, "Unhandled exception when chatting with @" + ctx.from.username + " (" + ctx.from.id + ") (Error ID: " + errId + "):\n" + cause)
		// TODO do we need to rethrow? or can we just treat all exceptions as handled here?
	}
	if (timerMsg) {
		const ms = moment().diff(start)
		const fuzzyTime = (ms) => (ms < 900) ? ms + "ms" : (ms < 60000) ? Math.round(ms/100)/10 + "s" : Math.floor(ms/60000) + "m " + Math.round((ms % 60000)/1000) + "s"
		console.log('This bot took %s to answer to: %s', fuzzyTime(ms), timerMsg)
	}
})

// TODO remove example
/*
bot.on('text', async (ctx, next) => {
console.log("'text' counter called")
  ctx.session.counter = ctx.session.counter || 0
  ctx.session.counter++
  await ctx.reply(`Message counter: ${ctx.session.counter}`)
  await next()
})
*/

// TODO remove example
/*
const sayYoMiddleware = (ctx, next) => {
	ctx.reply('yo').then(next)
}
*/

// TODO remove example
// Text messages handling
/*
bot.hears('Hey', sayYoMiddleware, async (ctx, next) => {
  ctx.session.heyCounter = ctx.session.heyCounter || 0
  ctx.session.heyCounter++
  await ctx.reply(`_Hey counter:_ ${ctx.session.heyCounter}`, {parse_mode: 'Markdown'})  
  await next()
})
*/

// TODO remove example
// Command handling
/*
bot.command('answer', sayYoMiddleware, (ctx) => {
  console.log(ctx.message)
  return ctx.reply('*42*', {parse_mode: 'Markdown'})
})
*/

// TODO remove example
/*
bot.command('cat',  async (ctx) =>{
  return ctx.replyWithPhoto({
    url: 'http://lorempixel.com/400/200/cats/'
  })
})
*/

// TODO remove example
// Wow! RegEx
/*
bot.hears(/reverse (.+)/, (ctx) => {
  return ctx.reply(ctx.match[1].split('').reverse().join(''))
})
*/

// weight measurements, one number followed by 'kg' and an optional comment
bot.hears(/^\s*(\d{2,3}([,.]\d)?)\s*[kK][gG](\s+(.+?))?\s*$/, async (ctx, next) => {
	const convg2kg = (g) => (g/1000 + " kg").replace(".", ",") // TODO better way to use German number format?
    let oUser = ctx.state.oUser
	if (! await auth.checkPermission(ctx, "qself", true)) {
        next()
		return
    }
	let row = {
		user_id: oUser.user_id,
		gramm: ctx.match[1].replace(",", ".") * 1000,
		comment: ctx.match[4] ? ctx.match[4] : "",
	}
    let rows = await god.executeSql("SELECT * FROM qself_weight WHERE DATE(TIMESTAMP) = CURDATE() LIMIT 3").catch(rethrow("reactWeight: SQL failed: %s"))
    if (rows.length == 0) {
		res = await god.executeSql("INSERT INTO qself_weight SET ?", [row]).catch(rethrow("reactWeight: SQL failed: %s"))
		var sReply = "Weight: " + convg2kg(row.gramm) + (row.comment ? " (" + row.comment + ")" : "")
		console.log("'" + sReply + "' inserted as row #" + res.insertId)
		// TODO add undo action to delete rows.insertId
	} else {
		res = await god.executeSql("UPDATE qself_weight SET ? WHERE id = ?", [row, rows[0].id]).catch(rethrow("reactWeight: SQL failed: %s"))
		var sReply = "Weight: " + convg2kg(row.gramm) + (row.comment ? " (" + row.comment + ")" : "") + " -- updated from " + convg2kg(rows[0].gramm) + (rows[0].comment ? " (" + rows[0].comment + ")" : "")
		console.log("'" + sReply + "' (updated for id " + rows[0].id + ")")
		// TODO add undo action to update rows.id with previous values
	}
	await ctx.reply(sReply, { reply_to_message_id: ctx.message.message_id } )
    await next()
})

// blood pressure measurement, three numbers and optional comment
bot.hears(/^\s*(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})(\s+(.+?))?\s*$/, async (ctx, next) => {
    let oUser = ctx.state.oUser
	if (! await auth.checkPermission(ctx, "qself", true)) {
        next()
		return
    }
	let row = {
		user_id: oUser.user_id,
		sys: ctx.match[1],
		dia: ctx.match[2],
		pulse: ctx.match[3],
		comment: ctx.match[5] ? ctx.match[5] : "",
	}
    let rows = await god.executeSql("SELECT * FROM qself_mmhg WHERE DATE(TIMESTAMP) = CURDATE() LIMIT 3").catch(rethrow("reactBloodPressure: SQL failed: %s"))
    if (rows.length == 0) {
		res = await god.executeSql("INSERT INTO qself_mmhg SET ?", [row]).catch(rethrow("reactBloodPressure: SQL failed: %s"))
		var sReply = "Blood pressure: " + row.sys + " / " + row.dia + ", Pulse: " + row.pulse + (row.comment ? " (" + row.comment + ")" : "")
		console.log("'" + sReply + "' inserted as row #" + res.insertId)
		// TODO add undo action to delete rows.insertId
	} else {
		res = await god.executeSql("UPDATE qself_mmhg SET ? WHERE id = ?", [row, rows[0].id]).catch(rethrow("reactBloodPressure: SQL failed: %s"))
		var sReply = "Blood pressure: " + row.sys + " / " + row.dia + ", Pulse: " + row.pulse + (row.comment ? " (" + row.comment + ")" : "") + " -- updated from " + rows[0].sys + " / " + rows[0].dia + " / " + rows[0].pulse + (rows[0].comment ? " (" + rows[0].comment + ")" : "")
		console.log("'" + sReply + "' (updated for id " + rows[0].id + ")")
		// TODO add undo action to update rows.id with previous values
	}
	await ctx.reply(sReply, { reply_to_message_id: ctx.message.message_id } )
    await next()
})

// ================================================================================================================================================
// ================================================================================================================================================
// ================================================================================================================================================

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.update.callback_query.data;
  const msg = callbackQuery.update.callback_query.message;

  console.log("Got action: " + action)
  if (action === 'select_list_0') {
	d_currentList = 0
	let text = "Todolist: " + d_lists[d_currentList].name + "\n"
	var markup = {
		  reply_markup: {
			inline_keyboard: [
			  [{ text: 'Home Item 1', callback_data: 'list_0_1' }],
			  [{ text: 'Home Item 2', callback_data: 'list_0_2' }]
			]
		  }
		};
    callbackQuery.editMessageText(text, markup);
  } else if (action === 'select_list_0') {
	let text = "This is Todo 'Home', Item 1"
	var markup = {
		  reply_markup: {
			inline_keyboard: [
			  [{ text: 'Done', callback_data: 'list_0_1_done' }],
			  [{ text: 'Edit', callback_data: 'list_0_2_edit' }]
			]
		  }
		};
    callbackQuery.editMessageText(text, markup);
  }
  
  else if (action === '1') {
    text = 'You hit button 1';
  const opts = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
  };
  callbackQuery.editMessageText(text, opts);
  } else if (action === '2') {
	let markup = {
			inline_keyboard: [
			  [{ text: 'Second Stage: A', callback_data: 'A' }],
			  [{ text: 'Second Stage: B', callback_data: 'B' }],
			]
	}
	callbackQuery.editMessageReplyMarkup(markup);
  } else if (action === 'A') {
	  console.log("got second stage A")
  } else {	  
	  callbackQuery.deleteMessage()
  }

});

var d_lists = [{
		name: 'Home',
	}, {
		name: 'Work',
	},
]
var d_currentList = 0
var d_currentMenuMessageId = 0

bot.command('menu',  async (ctx) => {
	return await showMainMenu(ctx)
})

async function showMainMenu(ctx) {
	let text = "Igor main menu for " + ctx.state.oUser.username + "\n"
	text += "Todolist: " + d_lists[d_currentList].name + "\n"
	var options = {
		  reply_markup: {
			inline_keyboard: [
			  [{ text: 'Home', callback_data: 'select_list_0' },
			  { text: 'Work', callback_data: 'select_list_1' },
			  { text: 'Show Lists', callback_data: 'show_lists' }]
			]
		  }
		};
	let reply = await ctx.reply(text, options)
	d_currentMenuMessageId = reply.message_id
}

// ================================================================================================================================================

// main program starts here
;(async () => {
	await require('./dbmaintenance')(god)
//	const reminder = await require('./reminder')(god)

	http.listen(config.api_port, config.api_host, function(){
	  logger.info('listening on %s:%s', config.api_host, config.api_port)
	})

	// Start polling
	bot.startPolling()
	console.log("Igor started.")
	
	bot.telegram.sendMessage(config.owner.chatId, "Master, I'm back (" + config.igor_version + ")")

})()

