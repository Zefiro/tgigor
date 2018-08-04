/* Telegram Bot "Igor"


Using the Telegram module from http://telegraf.js.org/


TODO
- change db handling to https://stackoverflow.com/a/40745825/131146
  -> better error handling, currently error handlers pile onto each other

*/

const Telegraf = require('telegraf')
const { session, reply } = require('telegraf')
const mysql = require('promise-mysql')
const util = require('util')
const moment = require('moment')
const fs = require('fs');
const path = require('path');

const auth = require('./auth.js')()
const undo = require('./undo.js')

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
let configBuffer = fs.readFileSync(path.resolve(__dirname, 'config', sConfigFile), 'utf-8');
let config = JSON.parse(configBuffer);


const bot = new Telegraf(config.tg_botkey)
bot.use(session())

var god = {
    config: config,
    executeSql: function() { console.error("This should have been overridden") },
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

god.executeSql_old = function(sqlString, values) {
    return new Promise(function(resolve, reject) {
    god.sqlPool.getConnection(function(err, connection) {
        if (err) {
          console.log("Error getting SQL connection from pool: " + err)
          reject(err)
          return;
        }
        connection.query(sqlString, values, function(err, rows){
            connection.release()
            if(!err) {
                resolve(rows)
            } else {
				console.log(util.format("Failed SQL: '%s' | Values:", sqlString, values))
                reject(err)
            }
        })
        connection.on('error', function(err) {
              console.log("Error in SQL connection: " + err)
              reject(err)
              return;
        })
    })
    })
}

const reminder = require('./reminder')(god)


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

/* Returns a function which throws an exception with the given msg as format string and parameters given to the function. For use in catch handlers. */
function rethrow(msg) {
	return (cause) => { throw util.format(msg, cause) }
}

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
	if (ctx.updateType === 'edited_message') {
		console.log("Message updated to: " + ctx.update.edited_message.text)
//        console.log(ctx)
		await next()
		return
	}
	if (ctx.updateType != 'message') {
		console.log("Unknown type of update: " + ctx.updateType)
    	console.log(ctx)
		await next()
		return
	}
    console.log("<" + ctx.from.username + "> " + ctx.message.text)
//	console.log(ctx.message)
    const start = moment()
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
    const ms = moment().diff(start)
	const fuzzyTime = (ms) => (ms < 900) ? ms + "ms" : (ms < 60000) ? Math.round(ms/100)/10 + "s" : Math.floor(ms/60000) + "m " + Math.round((ms % 60000)/1000) + "s"
    console.log('This bot took %s to answer to: <%s> %s', fuzzyTime(ms), ctx.from.username, ctx.message.text)
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
const sayYoMiddleware = (ctx, next) => {
	ctx.reply('yo').then(next)
}


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
bot.command('cat',  async (ctx) =>{
  return ctx.replyWithPhoto({
    url: 'http://lorempixel.com/400/200/cats/'
  })
})

// TODO remove example
// Wow! RegEx
bot.hears(/reverse (.+)/, (ctx) => {
  return ctx.reply(ctx.match[1].split('').reverse().join(''))
})

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
	// TODO if there is already a value for today, remove it?
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

// Start polling
bot.startPolling()
console.log("Igor started.")

bot.telegram.sendMessage(config.owner.chatId, "Master, I'm back (" + config.igor_version + ")")
