var moment = require('moment')
const util = require('util')

function rethrow(msg) {
	return function(cause) {
		throw util.format(msg, cause)
	}
}

module.exports = async function() { 
	let self = {

	executeSql: {},
	dbVersion: 0,
	
	init: async function(god) {
		this.executeSql = god.executeSql
		let rows = await this.executeSql("SHOW TABLES LIKE 'metadata'").catch(rethrow("dbMaintenance: Failed to determine if metadata table exists: "))
		if (rows.length > 0) {
    		let rows = await this.executeSql("SELECT dbVersion FROM metadata").catch(rethrow("dbMaintenance: Failed to load db version from metadata table: "))
			if (rows.length != 1) throw "dbMaintenance: When loading db version, one row was expected, but got " + rows.length
			this.dbVersion = rows[0].dbVersion
		}
		let origVersion = this.dbVersion
		console.log("dbMaintenance: Database is at version " + this.dbVersion)
		
		if (this.dbVersion == 0) {
			console.log("dbMaintenance: initializing database")
			this.dbVersion = 1
			await this.sql("CREATE TABLE metadata (dbVersion int(11) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;")
			await this.sql("INSERT INTO metadata (dbVersion) VALUES (1)")
		}

		if (this.dbVersion == 1) {
			console.log("dbMaintenance: upgrading database to version 2")
			this.dbVersion = 2
			let sqlString =
				"CREATE TABLE qself_mmhg (" +
				"id int(11) NOT NULL," +
				"user_id int(11) NOT NULL COMMENT 'Igor User ID'," +
				"timestamp datetime NOT NULL DEFAULT CURRENT_TIMESTAMP," +
				"sys int(11) NOT NULL," +
				"dia int(11) NOT NULL," +
				"pulse int(11) NOT NULL," +
				"comment varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" +
				") ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin"
			await this.sql(sqlString)
			sqlString =
				"ALTER TABLE `qself_mmhg` " +
				"ADD PRIMARY KEY (`id`)"
			await this.sql(sqlString)
			sqlString =
				"ALTER TABLE `qself_mmhg` " +
				"MODIFY `id` int(11) NOT NULL AUTO_INCREMENT"
			await this.sql(sqlString)
			sqlString =
				"CREATE TABLE qself_weight (" +
				"id int(11) NOT NULL," +
				"user_id int(11) NOT NULL COMMENT 'Igor User ID'," +
				"timestamp datetime NOT NULL DEFAULT CURRENT_TIMESTAMP," +
				"gramm int(11) NOT NULL," +
				"comment varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" +
				") ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin"
			await this.sql(sqlString)
			sqlString =
				"ALTER TABLE `qself_weight` " +
				"ADD PRIMARY KEY (`id`)"
			await this.sql(sqlString)
			sqlString =
				"ALTER TABLE `qself_weight` " +
				"MODIFY `id` int(11) NOT NULL AUTO_INCREMENT"
			await this.sql(sqlString)
			sqlString =
				"CREATE TABLE users (" +
				"user_id int(11) NOT NULL," +
				"tg_id int(11) NOT NULL," +
				"tg_chat_id int(11) NOT NULL COMMENT 'Chat ID for private chat with this user (unsure if this is always identical to the tg user id)'," +
				"username varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL," +
				"permissions varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" +
				") ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin"
			await this.sql(sqlString)
			sqlString =
				"INSERT INTO users (user_id, tg_id, tg_chat_id, username, permissions) VALUES" +
				"(1, " + god.config.owner.id + ", " + god.config.owner.chatId + ", 'ZefiroDragon', 'dragon')"
			await this.sql(sqlString)
			sqlString =
				"ALTER TABLE `users` " +
				"ADD PRIMARY KEY (`user_id`)," +
				"ADD UNIQUE KEY `tg_id` (`tg_id`)"
			await this.sql(sqlString)
			sqlString =
				"ALTER TABLE `users` " +
				"MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT"
			await this.sql(sqlString)
		}
		
		if (this.dbVersion > origVersion) {
			await this.sql("UPDATE `metadata` SET `dbVersion` = " + this.dbVersion)
		} else if (this.dbVersion < origVersion) {
			throw util.format("Current dbVersion %s is less than version %s we started with", this.dbVersion, origVersion)
		}
	},
	
	sql: async function(sqlString) {
		let result = await this.executeSql(sqlString).catch(rethrow("dbMaintenance: failed to execute sql:\n" + sqlString + "\n"))
	}
	
	}
    await self.init.apply(self, arguments)
    return self
}
