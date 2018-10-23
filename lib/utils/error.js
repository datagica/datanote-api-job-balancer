function error(
  res,
  errorCode = 405,
  response = 'Not Allowed',
  contentType = 'text/plain'
) {
  // Convert JSON responses to string
  if (typeof response === 'object') {
    response = JSON.stringify(response)
    contentType = 'application/json'
  }

  const contentLength = Buffer.byteLength(response.toString())
  res.statusCode = errorCode
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Length', contentLength)
  res.write(response)
  res.end()
  return
}

module.exports = error
