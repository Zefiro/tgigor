How Telegraf works:
* bot.on / bot.hears will create a chain of middleware in the order they are defined/called
* if a middleware calls next(), the next one will be run. Otherwise not.
* not sure if a middleware should return any value?
