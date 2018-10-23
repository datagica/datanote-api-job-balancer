'use strict'
const hash            = require('object-hash')
const WebSocketServer = require('rpc-websockets').Server
const config          = require('./config.json')
const isAllowed       = require('./core/isAllowed')(config.users)
const enforceLimits   = require('./core/enforceLimits')
require('./utils/removeIf')

const Jobs = {
  version   : 1,  // incremental version counter (we will reject old versions)
  index     : {}, // to retrieve jobs by their id
  todo      : [], // jobs that have not been taken by workers yet
  pending   : [], // jobs being processed by workers
  requestIds: 1,  // used for debug
  jobIds    : 1,  // part of the seed used to generate unique job ids
  promises  : {}
}

// basic logging system
const info  = (x) => { console.log(x) }
const debug = (x) => { if (config.debug) { console.log(x) } }
const error = (x) => { console.error(x) }

function postAndWaitJob(login, input, params, onReady) {

  const i = Jobs.jobIds++
  const job = {
    id    : i, // hash({ i, input }),
    user  : login,
    input : input, // user submitted data
    params: enforceLimits(params, config.apiLimits),
    responded: false
  }

  // debug(`initializing job ${job.id}`)

  const promise = new Promise(function (resolve, reject) {

    job.finish = function(result) {

      if (job.responded) {
        debug(`job #${job.id} by user ${JSON.stringify(job.user)} is finished, but too late :(`)
      } else {
        job.responded = true
        debug(`job #${job.id} by user ${JSON.stringify(job.user)} is finished`)
        clearTimeout(job.timeout)

        // clean after ourselves
        Jobs.pending.removeIf(({ id }) => id === job.id)
        delete Jobs.index[job.id]
        //delete job.finish
        //delete job

        // debug("[finish] pending jobs: "+JSON.stringify(Jobs.pending, null, 2))
        resolve(result)
      }
    }

    job.timeout = setTimeout(function(){
      if (job.responded) {
        // nothing to do, everything is fine
      } else {
        job.responded = true
        reject(new Error(`job #${job.id} by user ${JSON.stringify(job.user)} timed out`))
      }

    }, config.jobTimeout)

    Jobs.index[job.id] = job
    Jobs.todo.push(job)
    debug(`creating job #${job.id} for user ${JSON.stringify(job.user)}`)
    onReady()
  })

  job.promise = promise

  return promise
}

// instantiate Server and start listening for requests
var server = new WebSocketServer({
  port: config.port,
  host: config.host
})

// instead of using polling, we broadcast the arrival of a new job to all
// workers, the first to respond will pick it first
const broadcastNewJob = function () {
  debug('broadcasting the new job..')
  server.emit('newJob')
}

const onQuery = async ({ login, token, input, params }) => {
  if (!isAllowed(login, token)) {
    error(`user connection attempt rejected! (login: ${JSON.stringify(login)}, token: ${JSON.stringify(token)})`)
    throw new Error(`not allowed`)
  }
  const requestId = Jobs.requestIds++
  info(`received request #${requestId} from ${JSON.stringify(login)}`)
  const result = await postAndWaitJob(login, input, params, broadcastNewJob)
  info(`finished request #${requestId} from ${JSON.stringify(login)}`)
  return result
}

const onWorker = async ({ login, token, version, job }) => {

  debug(`${JSON.stringify(login)} (version ${version}) asked for a job`)

  if (login !== 'worker' || !isAllowed(login, token)) {
    error(`worker connection attempt rejected because of invalid token (login: ${JSON.stringify(login)}, token: ${JSON.stringify(token)}, version ${JSON.stringify(version)})`)
    throw new Error(`Not Allowed (invalid token)`)
  }


  if (isNaN(version) || !isFinite(version)) {
    error(`worker connection attempt rejected because of invalid version (login: ${JSON.stringify(login)}, token: ${JSON.stringify(token)}, version ${JSON.stringify(version)})`)
    throw new Error(`Not Allowed (invalid version)`)
  }

  if (version < Jobs.version) {
    error(`worker connection attempt rejected because of old version (login: ${JSON.stringify(login)}, token: ${JSON.stringify(token)}, version ${JSON.stringify(version)})`)
    throw new Error(`Not Allowed (outdated version)`)
  } else {
    Jobs.version = version
  }

  const requestId = Jobs.requestIds++

  // optional: save the completed job
  if (job && job.id && Jobs.index[job.id]) {
    debug(`${JSON.stringify(login)} finished job #${job.id} for user ${JSON.stringify(job.user)}`)
    setTimeout(() => {
      Jobs.index[job.id].finish(job.result)
    }, 100)
  }

  const newJob = Jobs.todo.shift()
  if (!newJob) {
    debug(`no new job to give to ${JSON.stringify(login)}`)
    return null
  }
  Jobs.pending.push(newJob)
  debug(`got a new job #${newJob.id} (from ${JSON.stringify(newJob.user)}) that we can give to ${JSON.stringify(login)}`)
  return {
    id    : newJob.id,
    user  : newJob.user,
    input : newJob.input,
    params: newJob.params
  }
}

server.register('query',  onQuery)
server.register('worker', onWorker)
server.event('newJob')

server.on('listening', function () {
  debug(`server started`)
})

server.on('error', function (err) {
  error(`${JSON.stringify(err, null, 2)}`)
})
