
const Datanote = require('@datagica/datanote-api-client')
// const Worker = require('@datagica/datanote-service-worker')

/*
spaw the api, and a worker, then run this
*/
console.log("starting datanote..")
const datanote = Datanote({
  url: 'http://localhost:3000',
  token: 'test'
})

console.log("awaiting result")

datanote('My name is Jane doe', {
  types: ['protagonist', 'virus']
}).then(result => {
  console.log(JSON.stringify(result, null, 2))
}).catch(exc => {
  console.error(exc.message)
})
