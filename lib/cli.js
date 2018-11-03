const program = require('commander')
const main = require('./index')

const parseUsers = (val, def) =>
 val
   ? val.split(',').map(u => u.split(':'))
   : def

program
  .version('0.0.0')
  .option('-d, --debug', 'debug mode')
  .option('-t, --timeout [timeout]', 'job timeout', parseInt)
  .option('-p, --port [port]', 'port [8979]', parseInt)
  .option('-h, --host [host]', 'host [localhost]', 'localhost')
  .option('-u, --users <users>', 'list of users', parseUsers, [['desktop', 'e85151ee9dd9e95d06067c8d5a2571f2605b9b1c']])
  .option('-m, --maxDomains [maxDomains]', 'max number of domains', parseInt)
  .option('-y, --maxTypes [maxTypes]', 'max number of types', parseInt)
  .parse(process.argv)

// install users
const users = {}

program.users.map(user => {
  users[user[0]] = { [user[1]]: true }
})

main({
  debug: program.debug,
  jobTimeout: program.timeout || 650000,
  port: program.port || 8979,
  host: program.host,
  apiLimits: {
    maxDomains: program.maxDomains || 1,
    maxTypes: program.maxTypes || 10
  },
  users,
})